#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/../../.." && pwd)
test_root=$(mktemp -d "${TMPDIR:-/tmp}/mumak-media-origin.XXXXXX")
container_name="mumak-media-origin-contract-$$"
image_tag="mumak-media-origin-contract:test-$$"
hash=$(printf 'a%.0s' $(seq 1 64))
asset_path="blog/$hash/content-v1"
headers_file="$test_root/headers"
body_file="$test_root/body"

cleanup() {
  docker rm -f "$container_name" >/dev/null 2>&1 || true
  docker image rm "$image_tag" >/dev/null 2>&1 || true
  rm -r "$test_root"
}
trap cleanup EXIT INT TERM

mkdir -p "$test_root/$asset_path"
printf 'jpeg-contract-fixture' >"$test_root/$asset_path/image.jpg"
printf 'webp-contract-fixture' >"$test_root/$asset_path/image.webp"

docker build --quiet -f "$repo_root/apps/admin/media-origin.Dockerfile" -t "$image_tag" "$repo_root" >/dev/null
docker run -d --name "$container_name" \
  --read-only \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --tmpfs /tmp:size=16m,noexec,nosuid,nodev \
  --tmpfs /var/cache/nginx:size=16m,noexec,nosuid,nodev \
  --tmpfs /var/run:size=1m,noexec,nosuid,nodev \
  -v "$test_root:/srv/media:ro" \
  -p 127.0.0.1::8080 \
  "$image_tag" >/dev/null

address=$(docker port "$container_name" 8080/tcp)
for _ in $(seq 1 50); do
  if curl -fsS "http://$address/healthz" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done
curl -fsS "http://$address/healthz" >/dev/null

request() {
  method=$1
  uri=$2
  if [ "$method" = HEAD ]; then
    curl -sS --path-as-is -I -D "$headers_file" -o /dev/null -w '%{http_code}' "http://$address$uri"
  else
    curl -sS --path-as-is -X "$method" -D "$headers_file" -o "$body_file" -w '%{http_code}' "http://$address$uri"
  fi
}

expect_status() {
  expected=$1
  method=$2
  uri=$3
  actual=$(request "$method" "$uri")
  if [ "$actual" != "$expected" ]; then
    printf 'expected %s, got %s for %s %s\n' "$expected" "$actual" "$method" "$uri" >&2
    exit 1
  fi
}

expect_header() {
  pattern=$1
  if ! grep -Eiq "$pattern" "$headers_file"; then
    printf 'missing header /%s/\n' "$pattern" >&2
    exit 1
  fi
}

expect_no_header() {
  pattern=$1
  if grep -Eiq "$pattern" "$headers_file"; then
    printf 'unexpected header /%s/\n' "$pattern" >&2
    exit 1
  fi
}

jpeg_uri="/$asset_path/image.jpg"
webp_uri="/$asset_path/image.webp"

expect_status 200 GET "$jpeg_uri"
expect_header '^Content-Type: image/jpeg'
expect_header '^Cache-Control: public, max-age=31536000, immutable'
expect_header '^X-Content-Type-Options: nosniff'
grep -qx 'jpeg-contract-fixture' "$body_file"

expect_status 200 HEAD "$webp_uri"
expect_header '^Content-Type: image/webp'

expect_status 405 POST "$jpeg_uri"
expect_no_header '^Cache-Control: .*immutable'

for uri in \
  "$jpeg_uri?download=1" \
  "/blog/$hash/source.jpg" \
  "/blog/$hash/manifest.json" \
  "/blog/$hash/junk/../content-v1/image.jpg" \
  "/blog/$hash/junk/%2e%2e/content-v1/image.jpg" \
  "//$asset_path/image.jpg" \
  "/blog/${hash}%2Fcontent-v1/image.jpg"
do
  expect_status 404 GET "$uri"
  expect_no_header '^Cache-Control: .*immutable'
done

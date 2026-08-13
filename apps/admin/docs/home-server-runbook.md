# 홈 서버 배포 런북

> 상태: 코드·CI/CD 준비 완료, 운영자 acceptance 대기
>
> 이 문서는 공개 가능한 절차만 담는다. 실제 경로, CIDR, token, 인증서, backup credential은
> Portainer/Vaultwarden와 별도 recovery card에만 둔다.

## 배포 결정

`apps/admin`은 Vercel에 배포하지 않는다. 이 앱은 단일 writer, 영구 RW bind mount, LAN/WireGuard
전용 ingress, 동일 파일시스템의 원자적 rename이 필요하다. serverless/preview replica는 이 계약과
맞지 않는다.

공급망은 기존 blog와 동일하다.

```text
develop/main push
  → CI + E2E success
  → promote.yml (push event + same-repository SHA만 허용)
  → linux/amd64 image build
  → ghcr.io/wannysim/mumak-admin:{latest,sha}
  → ghcr.io/wannysim/mumak-media-origin:{latest,sha}
  → 홈 서버 Watchtower pull
```

`workflow_run`은 기본 브랜치의 workflow 정의를 사용하므로 이 PR이 `develop`에만 머문 동안에는
기존 production promote가 admin을 모른다. 다음 정식 release로 이 workflow가 `main`에 들어간 뒤
admin/media-origin 자동 발행이 활성화된다. 그 전에는 임의 우회 배포하지 않는다.

GitHub-hosted runner는 사설 홈 서버에 접속하지 않는다. Portainer/NPM/DNS/Cloudflare/restic 변경은
운영자가 직접 한다.

## 1. 배포 전 실측

- [ ] production host에서 free disk와 현재 container RSS를 기록한다.
- [ ] 32 MiB/50 MP landscape, portrait, panorama JPEG로 admin peak RSS와 처리 시간을 측정한다.
- [ ] 측정값을 근거로 `MEDIA_ADMIN_MEMORY_LIMIT`, `MEDIA_ADMIN_HEAP_MB`, `MEDIA_MIN_FREE_BYTES`를 정한다.
- [ ] upload transform 중 blog, NPM, Vaultwarden 등 기존 container health가 유지되는지 확인한다.
- [ ] `source-v1` fixture checksum이 linux/amd64 Docker build에서 통과했는지 확인한다.

## 2. host storage와 secret

- [ ] host에 전용 root와 `.staging`, `private`, `published`를 먼저 만들고 owner를 UID/GID 1001로 둔다.
- [ ] root·`.staging`·`private`는 `0700`, `published`는 read-only origin이 탐색할 수 있게 `0755`로 설정한다. 새 asset은 app이 private `0700`/`0600`, public `0755`/`0644`로 생성한다.
- [ ] owner/mode를 확인한 뒤 stack을 배포한다. compose는 누락된 host path를 자동 생성하지 않고 실패해야 한다.
- [ ] `openssl rand -hex 32`로 token을 만들고 원문은 Vaultwarden에, SHA-256 digest만 stack secret/env에 둔다.
- [ ] host root, token digest, 실제 network/CIDR은 저장소에 commit하지 않는다.
- [ ] GHCR packages `mumak-admin`, `mumak-media-origin`에 repository Actions write와 홈 서버 read 권한을 준다.

## 3. Portainer stack

1. [`../docker-compose.yml`](../docker-compose.yml)을 private Portainer stack에 복사한다.
2. `${...:?required}` 값을 Portainer 환경 변수로 채운다.
3. NPM container가 참여한 기존 external network 이름을 `NPM_NETWORK_NAME`에 넣는다.
4. admin replica는 1개만 둔다. 두 서비스 모두 host port를 publish하지 않는다.
5. admin은 storage root RW, media-origin은 `published`만 RO인지 inspect한다.
6. `read_only`, `cap_drop: ALL`, `no-new-privileges`, resource/pid limit가 적용됐는지 inspect한다.
7. first deploy에는 immutable SHA tag를 사용하고 health가 확인된 뒤 `latest`/Watchtower tracking을 켠다.

## 4. private admin ingress

- [ ] private admin hostname은 public A/AAAA를 만들지 않는다.
- [ ] LAN/WireGuard DNS만 홈 서버 주소로 응답하게 한다.
- [ ] NPM에서 DNS-01 인증서를 발급하고 `mumak-admin:3000`으로 proxy한다.
- [ ] 실제 LAN/WireGuard CIDR allowlist를 적용하고 그 밖의 source는 거절한다.
- [ ] proxy body/header/read timeout을 app 상한(32 MiB, 120초)과 같거나 더 엄격하게 둔다.
- [ ] WAN, 잘못된 Host, 잘못된/없는 bearer token, CORS preflight가 모두 실패하는지 확인한다.

## 5. public media origin

- [ ] `img.wannysim.com`을 `mumak-media-origin:8080`으로 proxy한다.
- [ ] origin 도달 source를 Cloudflare IP로 제한한다.
- [ ] Cloudflare는 해당 host만 orange proxy로 두고 immutable path를 1년 cache한다.
- [ ] 허용 정규식 밖의 path/query, source/manifest, directory, POST/PUT가 404/405인지 확인한다.
- [ ] JPEG/WebP `Content-Type`, `nosniff`, immutable cache header를 확인한다.
- [ ] 두 번째 GET의 cache HIT/Age와 exact checksum을 확인한다.

## 6. backup과 복구

- [ ] `private`, `published`, manifest, 이 문서/compose/origin config를 encrypted restic으로 off-host backup한다.
- [ ] RPO 24시간, 보존 daily 7 / weekly 5 / monthly 12를 적용한다.
- [ ] 26시간 동안 backup heartbeat가 없으면 알림을 받는다.
- [ ] restic credential/password의 off-site recovery card를 준비한다.
- [ ] 홈 서버와 Vaultwarden을 사용할 수 없다고 가정하고 빈 임시 root로 restore한다.
- [ ] manifest checksum 전수 검사와 isolated media-origin exact-byte GET을 통과한다.

## 7. go-live와 rollback

1. admin에서 실제 JPEG 한 장을 올린다.
2. 반환된 JPEG/WebP URL과 source/JPEG/WebP checksum을 확인한다.
3. 반환 snippet을 임시 MDX에 넣고 web, RSS, preview에서 absolute URL·dimensions·alt·CLS를 확인한다.
4. 위 acceptance가 모두 통과한 뒤 production MDX에서 사용한다.
5. 앱 문제는 GHCR `:<sha>`로 admin을 rollback한다. 발행된 immutable bytes는 이전 앱으로 overwrite하지 않는다.
6. media-origin 문제는 검증된 `:<sha>`로 돌리되 storage bytes는 그대로 보존한다.

## 운영 관측

stdout의 `image-upload` JSON에서 result, duration, bytes, dimensions, asset id만 본다. token, request
body, filename, EXIF는 log에 없어야 한다. upload failure, staging age, free bytes, origin 4xx/5xx,
backup age를 기존 log/uptime 도구로 관측한다.

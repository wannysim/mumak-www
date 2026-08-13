# Media Admin

블로그 본문용 JPEG를 canonical source와 고정 JPEG/WebP rendition으로 발행하는 내부 운영 도구다.
영구 계약과 go-live 조건은 [`docs/architecture.md`](docs/architecture.md)가 유일한 기준이다.
홈 서버 구성은 [`docs/home-server-runbook.md`](docs/home-server-runbook.md)를 따른다.

## 로컬 실행

저장소 밖의 빈 디렉터리를 만든 뒤 `.env.local`에 `.env.example`의 값을 설정한다. bearer token
원문은 브라우저 탭 메모리와 비밀번호 관리자에만 두고, 서버에는 SHA-256 digest만 전달한다.

```sh
TOKEN="$(openssl rand -hex 32)"
printf '%s\n' "$TOKEN"
printf '%s' "$TOKEN" | shasum -a 256
unset TOKEN
pnpm --filter admin dev
```

로컬 origin은 `http://admin.mumak.localhost:1355`를 쓴다. production origin은 public DNS가 없는
private NPM hostname으로 정하고 Portainer에만 입력한다.

## 배포 경계

`Dockerfile`은 앱 이미지만 만든다. production 배포 전에는 SSOT §12와 §15의 host benchmark,
read-only media origin, NPM/WireGuard allowlist, off-host backup, 빈 위치 복구 시험을 완료해야 한다.
그 전에는 public URL 검증이 실패하므로 업로드도 성공으로 응답하지 않는다. secret, 실제 CIDR,
인증서, 복구 키는 이 공개 저장소에 두지 않는다.

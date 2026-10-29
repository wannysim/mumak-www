# Stickerbook

사진 전시 앱의 컨셉과 개발 기반. **2026-10-29 기존 디자인과 화면·인터랙션 구현을 제거했다. 현재 실행 화면은 빈 흰 바탕이다.**

- [plan.md](./plan.md): 유지할 컨셉과 사용자 선호
- [NEXT.md](./NEXT.md): 다음 세션의 시작점
- [implementation.md](./implementation.md): 남겨둔 개발 기반과 이전 실험의 교훈
- [public/assets.md](./public/assets.md): 보존한 샘플 JPG 출처

## 실행

저장소 루트에서:

```sh
pnpm install
pnpm --filter stickerbook dev
```

로컬 주소는 `http://stickerbook.mumak.localhost:1355`다. 같은 네트워크의 모바일에서는 Vite 로그의 `Network` 주소를 사용한다. 내부 포트와 IP는 고정하지 않는다.

## 검증

```sh
pnpm --filter stickerbook check-types
pnpm --filter stickerbook lint
pnpm --filter stickerbook format:check
pnpm --filter stickerbook test:ci
pnpm --filter stickerbook build
CI=1 pnpm --filter stickerbook exec playwright test --workers=2
pnpm exec knip --workspace apps/stickerbook
```

Vitest는 앱 마운트, Playwright는 빌드된 앱의 데스크톱·모바일 부팅을 확인한다. E2E 서버는 `3008`에서 실행하며 dev 서버를 재사용하지 않는다. 기존 책·스티커·사진 확대 기능의 테스트는 해당 구현과 함께 제거했다.

앱 CI 매트릭스와 coverage 등록은 유지한다. PR·병합·배포는 수행하지 않았다.

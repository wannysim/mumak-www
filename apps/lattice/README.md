# Lattice

손 제스처로 비디오 레이어에 필터를 드래그앤드롭하는 실험 앱입니다.
[anainsomnia.com/lattice](https://www.anainsomnia.com/lattice)에서 영감을 받았습니다.
`mumak-react` 템플릿을 복제해 만들었습니다.

- 레이어드 비디오 4개 + 이동/리사이즈 가능한 필터 존(pane) — 존과 겹친 영상 부분에만 필터가 보인다
- CSS `backdrop-filter` 존 5종 + canvas 합성 기반 ascii 존 1종
- 영상 소스는 전부 CORS 허용 CDN — ascii 존이 canvas `getImageData`로 픽셀을 읽어야 하므로 교체 시에도 ACAO 헤더 확인 필요
- MediaPipe HandLandmarker(웹캠)로 손 추적: 칩을 핀치해 놓으면 존 생성, 존 몸통 핀치로 이동, 우하단 핸들 핀치로 리사이즈
- 카메라가 없거나 거부되면 칩 클릭으로 존 생성, 마우스 드래그로 이동/리사이즈

## 개발 환경

- Node.js 24.11.1+
- pnpm

## 설치 및 실행

의존성은 워크스페이스 루트에서 설치합니다.

```bash
pnpm install
pnpm --filter=lattice dev
```

개발 서버는 Portless를 사용하며 기본 URL은 `http://lattice.mumak.localhost:1355`입니다.
카메라 권한이 필요하므로 secure context로 취급되는 `.localhost` 도메인에서 Chrome 사용을 권장합니다.
E2E/CI용 preview 포트는 `3004`입니다.

## 테스트

```bash
pnpm --filter=lattice test      # Vitest 단위 테스트 (핀치 판정 로직 등)
pnpm --filter=lattice test:e2e  # Playwright E2E (클릭 폴백 기준)
```

손 추적 품질은 조명 영향을 받습니다. 핀치 임계값은 `src/components/lattice.tsx`의
`PINCH_ON` / `PINCH_OFF` 상수로 조절합니다.

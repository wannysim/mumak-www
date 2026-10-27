# Stickerbook

책상 위 사진 스티커북을 직접 만져보는 독립 React + Vite 프로토타입. 컨셉은 [plan.md](./plan.md), 시각 디자인과 레퍼런스는 [design.md](./design.md), 기술 선택·지원 범위는 [implementation.md](./implementation.md)에 기록한다.

개발을 이어갈 때는 [NEXT.md](./NEXT.md)를 먼저 읽는다. 현재 상태, 사용자 선택, 남은 한계와 다음 확인 순서를 한곳에 정리했다.

## 실행

저장소 루트에서:

```sh
pnpm install
pnpm --filter stickerbook dev
```

로컬 주소: http://stickerbook.mumak.localhost:1355

같은 Wi-Fi의 모바일에서는 Vite 시작 로그의 `Network` 주소를 사용한다. `localhost` 주소는 다른 기기에서 이 컴퓨터를 가리키지 않는다. dev는 `0.0.0.0`에 바인딩하며 Portless가 내부 포트를 배정한다. 앱을 재시작하면 내부 포트가 바뀔 수 있다.

## 조작

- 종이 여백 드래그: 잡은 높이와 위아래 당김에 따라 접힘 방향이 바뀌고 놓으면 완주/복귀. 첫 페이지·마지막 페이지 경계 유지.
- 이전/다음 버튼, 책 포커스 후 방향키: 동일한 사진 순서. 키보드는 즉시 전환.
- 사진 클릭: 확대. Escape로 닫고 원래 버튼으로 포커스 복귀.
- 여우 스티커 드래그: 64 CSS px 이상 떼고, 관측한 최대 속도가 0.65 px/ms를 넘으면 자국. 물리적 힘 센서가 아니라 입력 속도의 근사다.
- 스티커 클릭/Enter: 깨끗하게 떼기. Shift + 클릭/Enter: 자국 남기기. 떼어낸 자리는 흐릿하게 표시되며 다시 누르면 붙인다.
- 스티커 되돌리기: 모든 페이지의 스티커/자국 초기화. 새로고침해도 초기화한다.
- 커피잔·카메라·연필: 넓은 화면 가장자리의 소품 반응. 작은 화면에서는 사진 공간을 우선한다.

넘김 표현과 시작 시 교체 현상의 수정 기록은 [motion.md](./motion.md)를 따른다.

## 화면과 성능

정지·드래그·착지 모두 같은 `AlbumPage` HTML과 CSS를 사용한다. 접힌 앞·뒷면을 잘라 배치하고, 좁은 말림 구간만 12개 띠로 변형한다. 페이지를 비트맵으로 다시 그리지 않으며 WebGL이나 별도의 렌더러 로딩이 없다. `prefers-reduced-motion`은 즉시 전환한다.

- 모든 화면: 좌우 두 페이지. 01–02 → 03–04 → 05–06. 오른쪽 02쪽의 뒷면이 다음 펼침의 왼쪽 03쪽이며, 그 아래에서 04쪽이 드러난다. 역방향도 같은 장의 앞·뒷면을 사용한다.
- 세로 휴대폰: 펼침 전체를 화면에 맞춘다. 사진은 눌러 확대하며, 스티커 터치 영역은 최소 44px을 유지한다.
- 화면 회전/리사이즈: 선택한 사진 유지. 진행 중 제스처는 취소.
- 지원 브라우저의 실제 `window.viewport.segments`: 좌우 힌지 회피 / 상하 사진·조작 분리.
- 높이가 매우 작은 구획: 사진 중심의 간략한 보기, 즉시 전환. EXIF는 확대 보기에서 확인.
- 접힘 API가 없으면 일반 반응형. 기기 모델명으로 접힘을 추정하지 않는다.
- Safari 27.1 iPhone Duo의 분할/접힘 API는 feature flag 뒤의 preview다. Chromium CDP 분할 에뮬레이션과 실제 하드웨어 테스트는 서로 다른 검증 범위다.

## 검증

```sh
pnpm --filter stickerbook check-types
pnpm --filter stickerbook lint
pnpm --filter stickerbook format:check
pnpm --filter stickerbook test:ci
pnpm --filter stickerbook build
CI=1 pnpm --filter stickerbook exec playwright test --workers=2
```

E2E는 빌드 결과를 `3008`에서 띄우며 dev 서버를 재사용하지 않는다. 단위 테스트는 입력 판정·페이지 경계·힌지 배치·상태 유지·포커스·앞뒤 면의 방향과 크기를 검증한다. Chromium·Firefox·WebKit에서 데스크톱과 DPR 3 모바일의 이동 중 폰트 크기·페이지 너비·앞뒷면 연결을 검사한다. 접힘 API와 실제 터치 타이밍 검사는 Chromium CDP 에뮬레이션이다. 최신 결과와 한계는 [motion.md](./motion.md)를 따른다.

사진과 여우는 [임시 자산](./public/assets.md)이다. 사용자 fursona와 실제 사진 EXIF의 추출·저장 파이프라인은 연결하지 않았다. 작업 브랜치에 저장한 프로토타입이며, PR·병합·배포는 별도 작업이다.

# Stickerbook 개발 기반

2026-10-29 사용자 요청으로 기존 디자인을 초기화했고, 2026-11-13 임시값으로 동작하는 1페이즈를 새로 만들었다.

## 1페이즈 구조 (2026-11-13)

- `src/model/fold/`: 넘김 동작 규칙(반사 접힘, 책등 제한, 진행도, 놓기 판정, 속도, 클릭 넘김 경로, 원통, 쪽 매핑, 입력 우선순위). 순수 TS, node 환경 테스트.
- `src/model/book/`: 책 상태 기계(closed → opening → open ↔ turning), 회전, 배치 판정(spread·single), 키 매핑, 넘김 세션, 펼침 시간표, 화면 기하 변환. 순수 TS.
- `src/features/closed-book/`: CSS 3D 닫힌 책과 펼침 전환. `src/features/book-spread/`: 쪽과 평면 DOM 접힘 넘김(clip-path 다각형과 반사 matrix). `src/features/running-head/`: 러닝 헤드.
- `src/content/`: 쪽 지도(`pages.ts`)와 임시 문구·값(`temporary.ts`). `src/hooks/`: 창 크기, 동작 줄이기, 프레임 루프.
- 서체는 blog의 Pretendard 서브셋을 `src/assets/fonts/`에 자체 호스팅하고, 색은 blog 토큰을 `src/index.css`에 옮겼다(출처 주석).
- 렌더는 1페이즈 동안 DOM만 쓴다. WebGL·three는 아직 없다. `src/render/`는 WebGL 코드용으로 coverage에서 빼 두었다.
- dev 전용 페이지: `mockups/still/`(정지 화면 시안), `spikes/s1/`(글자·사진 래스터 비교 하네스). 프로덕션 빌드에 들어가지 않는다.

## 유지한 기반

- React + TypeScript + Vite, `@/` alias, Tailwind v4 빌드 연결.
- Portless 개발 주소 `stickerbook.mumak.localhost:1355`, 빌드/preview 스크립트, Playwright 서버 포트 3009.
- 공통 TypeScript·Playwright 설정, Oxc lint·format, Vitest·Testing Library와 coverage, Chromium·Firefox·WebKit E2E.
- 모노레포 앱 매트릭스·Codecov 등록. JPG 6개와 출처 문서는 1페이즈의 임시 샘플 사진으로 쓴다.

## 제거한 구현

책상 레이아웃, 책·사진 프레임·테이프·스티커·소품 컴포넌트와 스타일, 페이지 접힘 렌더러·제스처·상태, 사진/안내 다이얼로그, 기존 viewport 접힘 대응, 임시 여우 SVG·전용 서체, 해당 기능 테스트를 제거했다. 사용하지 않는 UI·아이콘 의존성과 테스트 제스처 mock도 정리했다.

화면을 지웠다고 컨셉까지 폐기한 것은 아니다. 좌우 펼침과 뒷면 관계, 스티커 아이디어는 [plan.md](./plan.md)에 남긴다. 책상과 소품은 2026-11-10, 폴라로이드·테이프·EXIF는 2026-11-13 컨셉에서 뺐다.

## 이전 실험에서 배운 점

- 정지 화면은 HTML, 이동 화면은 수동 Canvas 그림으로 만들면 글자 크기·선명도 규칙이 달라질 수 있다. 당시 CSS 최소 10px과 Canvas의 고정 논리 크기가 어긋나 사용자가 축소를 인지했다.
- 누른 채 가만히 있는 화면이 같다는 검사만으로는 부족하다. 다음 구현에서는 움직이는 중과 착지까지 같은 기준으로 비교한다.
- 이후 HTML을 잘라 곡면을 근사했지만 중앙 국소 변형·곡면 경계·실기기 성능에는 한계가 남았다. **이 렌더러는 현재 제거됐으며 다음 디자인의 확정 기술이 아니다.**
- 기능 검증이 통과해도 디자인 만족도를 대신하지 않는다. 시각 방향을 먼저 사용자와 확인한다.

이전 코드·디자인·모션 문서·검증 결과는 [초기화 전 커밋 243b0f7](https://github.com/wannysim/mumak-www/tree/243b0f733f6830264ae6e90d5f2766f521acf399/apps/stickerbook)(2026-11-13 develop rebase 전 해시 `e708e3e`, 이때 E2E 포트만 3009로 바뀜)에 보존돼 있다. 참고용이며 자동 복구하거나 현재 구현으로 인용하지 않는다. 당시의 단위 41개·E2E 29개 결과는 현재 기능 지원을 뜻하지 않는다.

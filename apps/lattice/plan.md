# Lattice 리팩토링 계획

`src/components/lattice.tsx` 단일 파일 780줄의 책임 분리. 동작 변경 없음, 가독성·SRP 개선이 목표.

## 배경

- 순수 함수는 이미 분리·테스트됨 (단위 34케이스 + 인터랙션 20케이스).
- 마우스/손 두 입력이 `beginDrag/updateDrag/spawnPane` 코어로 수렴하는 설계는 유지한다.
- 순환 의존 없음 (self-contained 모듈).
- 안전망: `pnpm --filter=lattice test` 그린이 각 단계 완료 기준. 스냅샷 아님.

## 목표 구조

```
src/components/lattice/
├── geometry.ts        # Box, ResizeEdges, edgesAt, resizeBox, EDGE_GRAB, PANE_MIN_*
├── tracking.ts        # PINCH_*, EDGE_MARGIN, pinchDistance, nextPinch, remapToScreen, createOneEuro
├── ascii.ts           # ASCII_CHARS, luminanceToChar, coverSourceRect, saturateChannel
├── ascii-pane.tsx     # AsciiPane
├── use-hand-tracking.ts
└── lattice.tsx        # 상태 + 얇은 JSX (~250줄)
```

## Phase 1 — 무위험 정리 (반나절)

- [ ] 1.1 순수 함수 3개 모듈 분리 (`geometry` / `tracking` / `ascii`) + 테스트 import 경로 교체
  - 대상: `lattice.tsx:55-168` → `lattice/*.ts` · diff ~150줄(이동) · 선행 없음
- [ ] 1.2 `AsciiPane` → `lattice/ascii-pane.tsx` 이동
  - 대상: `lattice.tsx:170-294` · diff ~125줄(이동) · 선행 1.1

## Phase 2 — 책임 분리 (핵심)

- [ ] 2.1 손 추적 `useEffect` → `useHandTracking` 훅
  - 대상: `lattice.tsx:461-602` → `use-hand-tracking.ts` · diff ~150줄 · 선행 1.1
  - 인터페이스: `gestures: { onGrab, onDrag, onDrop, onHandLost }` + `onStatus`
  - 결과: 컴포넌트가 MediaPipe를 import하지 않음 (DIP)
  - 검증: `lattice-interaction.test.tsx`의 hand gestures 5케이스 그대로 통과
- [ ] 2.2 (선택) 렌더 서브컴포넌트 분리 `VideoLayer` / `FilterPane` / `FilterChip` / `HandCursor`
  - 대상: `lattice.tsx:604-780` · diff ~180줄 · 선행 없음

## Phase 3 — 생략 권장 (조건부)

- AsciiPane DIP: `AsciiPane`이 전역 `VIDEOS` + `'cam'` 하드코딩(`216-219`)에 결합. 영상 소스가 실제로 늘 때만 호출부 주입으로 전환.
- OCP 레지스트리: `isAsciiFilter` 2분기(`662`, `708-720`)는 안정적. 필터 종류가 3+로 늘고 히스토리상 증가가 관측될 때만.

## 실질 가치

최종: `lattice.tsx` 780 → ~250줄 + 모듈/훅 5개. 핵심 가치는 2.1(손추적 훅)과 1.1/1.2(모듈 분리). 나머지는 선택.

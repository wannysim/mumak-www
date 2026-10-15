# mumak-www 디자인시스템

`apps/blog/plan.md`의 실행 산출물. 계획은 그쪽, 증거는 여기.

**지금 할 일을 찾는다면 [NEXT.md](NEXT.md)부터.**

## 문서

| 파일                                   | 내용                                                     | 상태                          |
| -------------------------------------- | -------------------------------------------------------- | ----------------------------- |
| [NEXT.md](NEXT.md)                     | **액션 아이템 단일 소재지.** 지금 네 차례인 일           | 계속 갱신                     |
| [storybook.md](storybook.md)           | Storybook 실습 공간과 실행 방법                          | 시작·규칙·버튼·카드·비교      |
| [audit.md](audit.md)                   | 단계 0 기준선. token, 대비, motion, component, 검증 공백 | 단계 0 완료                   |
| [principles.md](principles.md)         | 사람 중심 탐색 목적과 원칙 4개·통과/기각 예              | 사진 중심 방향 결정·비평 남음 |
| [home-direction.md](home-direction.md) | 홈 레퍼런스·취향·소재·표현 선호 기록                     | 디자인 구현 원복·재검토       |
| [support-matrix.md](support-matrix.md) | 지원 6개 / 비지원 / 승격 후보                            | 단계 0 완료                   |
| [exceptions.md](exceptions.md)         | 시스템에 흡수하지 않기로 한 것                           | 단계 0 완료                   |
| [decision-log.md](decision-log.md)     | 선택·기각·보류 근거                                      | 계속 갱신                     |
| [baselines/](baselines/)               | 대표 화면 36장 + manifest                                | 스크립트 생성                 |

## 기준선 다시 뜨기

```bash
pnpm --filter blog build
pnpm --filter blog start:e2e &
cd apps/blog && node scripts/capture-baselines.mjs
```

- 회귀 테스트가 아니라 문서 산출물이다. CI에서 돌지 않고 아무것도 단정하지 않는다.
- 픽셀 단정은 단계 3에서 기존 blog Playwright 안에 `toHaveScreenshot`으로 들어간다 ([decision-log D-001](decision-log.md)).
- `--only=<substr>`로 일부만, `--base-url=<url>`로 다른 서버를 대상으로 실행할 수 있다.

## 지금 상태 한 줄

토큰 이름과 규율은 이미 서 있고(`validate:design` 위반 0건), 문제는 **값의 대비**와 **모션 규율 부재**다.
단계 1에서 손대는 축은 color(대비)와 motion 둘뿐이다. type/space는 반복 근거가 없어 건드리지 않는다.

2026-10-15: light `--ring`을 독립 값으로 수정하고 Button·ContentCard의 outline을 통일했다(D-011). 기본 배경 대비는 7.92:1이다. 사용자가 Figma 대신 Storybook 학습을 제안해 [실습 공간](./storybook.md)을 확장했다(D-012). Figma 대응은 후속 보류이며, 다른 component의 자체 포커스 override·reduced-motion·기존 주황색 버튼 글자 대비는 남는다. 포커스 검증 범위는 [실습 기록](./focus-lab.md)을 본다.

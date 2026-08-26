# mumak-www 디자인시스템

`apps/blog/plan.md`의 실행 산출물. 계획은 그쪽, 증거는 여기.

**지금 할 일을 찾는다면 [NEXT.md](NEXT.md)부터.**

## 문서

| 파일                                   | 내용                                                     | 상태                     |
| -------------------------------------- | -------------------------------------------------------- | ------------------------ |
| [NEXT.md](NEXT.md)                     | **액션 아이템 단일 소재지.** 지금 네 차례인 일           | 계속 갱신                |
| [audit.md](audit.md)                   | 단계 0 기준선. token, 대비, motion, component, 검증 공백 | 단계 0 완료              |
| [principles.md](principles.md)         | 제품 원칙 3개와 통과/기각 예                             | **초안. 본인이 다시 씀** |
| [support-matrix.md](support-matrix.md) | 지원 6개 / 비지원 / 승격 후보                            | 단계 0 완료              |
| [exceptions.md](exceptions.md)         | 시스템에 흡수하지 않기로 한 것                           | 단계 0 완료              |
| [decision-log.md](decision-log.md)     | 결정 7건, 기각 1건, 열린 질문 3건                        | 계속 갱신                |
| [baselines/](baselines/)               | 대표 화면 36장 + manifest                                | 스크립트 생성            |

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

가장 먼저 고칠 것: **light 모드 `--ring` 2.82:1** — 유일하게 확인된 접근성 결함이고, 기존 axe 스캔이 잡지 못하는 축이다.

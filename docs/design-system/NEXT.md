# 다음 실습

> 현재 액션 아이템의 단일 소재지. 단계별 목표와 진행률은 [plan.md](../../apps/blog/plan.md), 결정 근거는 [decision-log.md](./decision-log.md), 실행 방법은 [storybook.md](./storybook.md)에 둔다.

갱신: 2026-10-15. 단계 1 진행 중. 사진전 중심 홈 개편과 Figma 대응은 보류한다.

## 지금까지 완료한 것

| 항목                | 현재 상태                                                     | 근거                               |
| ------------------- | ------------------------------------------------------------- | ---------------------------------- |
| 포커스 표현 선택    | B: 불투명 2px outline + 2px offset                            | D-011                              |
| 포커스 색의 책임    | `--ring`을 `--accent-foreground`와 독립적으로 유지            | D-011                              |
| 제품 적용           | 공통 foundation·Button·ContentCard 적용, Blog/Garden에서 검증 | [포커스 기록](./focus-lab.md)      |
| Storybook 학습 공간 | 시작 안내·실제 token·버튼·카드·A/B 비교                       | D-012, [실습 안내](./storybook.md) |
| 전역 테마           | 스토리 이동 시 테마 유지, 테마 전환 시 실습 상태 유지         | D-013                              |

구현 커밋: [`644eb34`](https://github.com/wannysim/mumak-www/commit/644eb34), 브랜치 `feature/blog-focus-lab`. 원격 push 완료이며 develop 반영은 PR 병합 후다. 로컬 검증 결과는 위 실습 기록에 둔다.

## 다음 실습: 버튼 상태와 글자 대비

[Storybook 시작 화면](http://127.0.0.1:6006/?path=/story/start-welcome--welcome) → **버튼 / Playground**. 실행이 필요하면 `pnpm --filter blog storybook`.

1. 상단 Theme 메뉴와 Controls의 variant·disabled·invalid를 바꾸며 hover·focus·pressed를 비교한다. 사용자가 실습 구성을 확인했고 전역 테마 개선까지 마쳤으므로 도구 구축을 다시 시작하지 않는다.
2. 다음 판단 후보는 **밝은 테마 기본 주황색 버튼의 글자 대비 3.33:1**이다. 에이전트가 실제 버튼으로 비교안과 측정값을 준비하고, 사용자가 가독성·강조 정도·다른 상태와의 구분을 보고 선택한다. 아직 수정안은 선택하지 않았다.
3. 선택 이유와 기각 조건을 기록한 뒤 실제 Button에 적용하고, Storybook 및 소비 화면에서 회귀를 확인한다. 이번 PR에 다음 디자인 결정을 미리 구현하지 않는다.

진행 순서: 사용자 문제 → 비교·측정 → 사용자 판단 → 구현 → 검증. 현재 색이 같다는 이유만으로 역할이 다른 token을 공통화하지 않는다.

## 남은 범위와 보류

- 다른 component의 자체 focus override, sidebar token, karaoke/quant의 제품별 theme: 미이전·미검증. 현재 포커스 작업을 사이트 전체의 완료로 보지 않는다.
- motion·reduced-motion·타깃 크기·loading 상태·visual baseline: 단계 1~2의 남은 범위. 지원 계약은 [support-matrix.md](./support-matrix.md) 참조.
- Figma Variables·component 대응: 파일과 협업 필요가 생기면 재개. Storybook 구현으로 Figma 역량을 완료했다고 간주하지 않는다.
- 사진전 중심 홈 개편, 5분 사진전 설명 녹화·자기 비평: 보류. 지금 학습의 선행 조건이 아니다.
- type/spacing token, 전체 UI 카탈로그, token 생성 패키지, 독립 배포: 현재 추가하지 않는다.
- `PostTags` 승격, D-009 viewport 구현, empty/state recipe, `SwitcherDropdown` 테스트, P-4 본문 읽기 비교: 기존 후속 단계에서 재평가한다.

이전 미완 작업과 당시 우선순위는 [2026-09-18 중단 기록](./history/2026-09-18-checkpoint.md)에 보존했다. 단계 0의 설명·비평과 단계 1 전체를 완료로 표시하지 않는다.

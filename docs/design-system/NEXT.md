# 다음 실습

> 현재 액션 아이템의 단일 소재지. 단계별 목표와 진행률은 [plan.md](../../apps/blog/plan.md), 결정 근거는 [decision-log.md](./decision-log.md), 실행 방법은 [storybook.md](./storybook.md)에 둔다.

갱신: 2026-10-16. 단계 1 진행 중. 사진전 중심 홈 개편과 Figma 대응은 보류한다.

## 지금까지 완료한 것

| 항목                | 현재 상태                                                     | 근거                               |
| ------------------- | ------------------------------------------------------------- | ---------------------------------- |
| 포커스 표현 선택    | B: 불투명 2px outline + 2px offset                            | D-011                              |
| 포커스 색의 책임    | `--ring`을 `--accent-foreground`와 독립적으로 유지            | D-011                              |
| 제품 적용           | 공통 foundation·Button·ContentCard 적용, Blog/Garden에서 검증 | [포커스 기록](./focus-lab.md)      |
| Storybook 학습 공간 | 시작 안내·실제 token·버튼·카드·A/B 비교                       | D-012, [실습 안내](./storybook.md) |
| 전역 테마           | 스토리 이동 시 테마 유지, 테마 전환 시 실습 상태 유지         | D-013                              |

이전 구현은 [PR #633](https://github.com/wannysim/mumak-www/pull/633)에서 develop에 squash merge 완료했다. 병합 커밋은 `bb64e38`이며 이번 실습은 해당 커밋에서 `feature/button-contrast-lab`으로 분기했다. 이전 “병합 전” 문구는 갱신되지 않은 기록이었다.

## 버튼 상태와 글자 대비: 제품 반영

[제품 버튼](http://127.0.0.1:6006/?path=/story/components-button--playground&args=variant:default&globals=locale:ko;theme:light)과 [D/E 비교](http://127.0.0.1:6006/?path=/story/learning-button-contrast--hover&globals=locale:ko;theme:light). 실행은 `pnpm --filter blog storybook`.

1. **D 기본색 + E hover 채택:** 사용자가 비교·누락 점검·Space/Enter 동작 확인 후 제품 반영을 승인했다. Light 글자 대비는 기본 4.62:1, hover 5.90:1이다. 결정은 D-014, 측정·검증 범위는 [실습 기록](./button-contrast-lab.md)에 둔다.
2. 기본 Button은 독립 `--button-background`·`--button-foreground`·`--button-hover`를 사용한다. 브랜드 `--primary`와 다른 variant는 색을 유지한다. Dark 및 karaoke/quant의 별도 테마도 기존 색을 보존한다.
3. 기존 pressed 1px 이동과 네이티브 키보드 실행을 유지한다. `prefers-reduced-motion: reduce`에서는 Button 전환을 생략한다. 터치의 hover 제한은 제품 utility를 사용한다.
4. 현재 브랜치의 구현·문서·검증을 정리한 뒤 커밋/PR로 마무리한다. 다음 학습은 loading·타깃 크기 등 남은 계약에서 사용자와 선택한다. 단계 1 전체 완료는 아니다.

진행 순서: 사용자 문제 → 비교·측정 → 사용자 판단 → 구현 → 검증. 현재 색이 같다는 이유만으로 역할이 다른 token을 공통화하지 않는다.

## 남은 범위와 보류

- 다른 component의 자체 focus override, sidebar token, karaoke/quant의 제품별 theme: 미이전·미검증. 현재 포커스 작업을 사이트 전체의 완료로 보지 않는다.
- Button 밖의 motion·reduced-motion, 타깃 크기·loading 상태·visual baseline: 단계 1~2의 남은 범위. 지원 계약은 [support-matrix.md](./support-matrix.md) 참조.
- Figma Variables·component 대응: 파일과 협업 필요가 생기면 재개. Storybook 구현으로 Figma 역량을 완료했다고 간주하지 않는다.
- 사진전 중심 홈 개편, 5분 사진전 설명 녹화·자기 비평: 보류. 지금 학습의 선행 조건이 아니다.
- type/spacing token, 전체 UI 카탈로그, token 생성 패키지, 독립 배포: 현재 추가하지 않는다.
- `PostTags` 승격, D-009 viewport 구현, empty/state recipe, `SwitcherDropdown` 테스트, P-4 본문 읽기 비교: 기존 후속 단계에서 재평가한다.

이전 미완 작업과 당시 우선순위는 [2026-09-18 중단 기록](./history/2026-09-18-checkpoint.md)에 보존했다. 단계 0의 설명·비평과 단계 1 전체를 완료로 표시하지 않는다.

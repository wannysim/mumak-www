# 다음 작업

> 현재 액션 아이템의 단일 소재지. 단계별 목표는 [plan.md](../../apps/blog/plan.md), 선택 이유는 [decision-log.md](./decision-log.md), 실행 방법은 [storybook.md](./storybook.md)에 둔다. 공통 규칙은 [인터랙션 계약](./interaction-contracts.md), 적용 현황은 [support-matrix.md §7](./support-matrix.md#7-인터랙션-적용-현황)이 정본이다.

갱신: 2026-10-20. 단계 1 진행 중. 사진전 중심 홈 개편과 Figma 대응은 보류한다.

## 앞선 작업의 완료 범위

| 작업                  | 완료한 범위                                                              | 남은 경계                                               |
| --------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------- |
| D-011·D-017 포커스    | 공유 컨트롤·복합 표면·Blog 트리/skip link·quant override 이전            | 의도된 예외와 미검증 컴포넌트·배치 추적                 |
| D-012·D-013 학습 공간 | Storybook 시작 안내·실제 컴포넌트 비교·전역 테마와 실습 상태 유지        | Figma·전체 카탈로그를 완료한 것은 아님                  |
| D-014 버튼 대비       | D 기본색 + E hover, 독립 버튼 역할 token, Light 4.62:1 / 5.90:1          | 다른 variant·모든 소비 화면의 대비 보증 아님            |
| D-014 입력 피드백     | 기존 pressed 1px·네이티브 키보드 유지, Button의 reduced-motion 전환 생략 | Button 밖의 motion 계약                                 |
| D-015·D-017 loading   | 공유 LoadingButton, Storybook C·admin 요청 6종 적용                      | 복사 pending 모델·다른 앱 요청 분류, 실제 보조기술 검증 |
| D-016 타깃            | A/B/C 실습과 실제 모바일 C 선택                                          | 제품 미적용. 공통 표현·소비 배치 검토 필요              |
| 일관성 점검           | 앞선 개선의 계약·적용 현황과 Blog 아이콘·admin 요청 소비처 정리          | 전수 제품 검증·이전 완료 아님                           |

병합 이력: PR #633 `bb64e38`(포커스·학습 공간), #634 `51a500f`(버튼 대비), #635 `913c3ad6`(loading 실습), #636 `360995ed`(admin 로그인). 이전 “커밋/PR로 마무리” 문구는 당시 병합 전 기록이다. 현재 `feature/button-target-size-lab`은 #636 병합 후 분기했고 타깃 실습·선택·적용 현황과 D-017 포커스·loading 공통화는 아직 작업 트리에 있다.

## 다음 구현: C 타깃의 공통 표현과 같은 역할 소비처

1. **공통 표현의 경계를 정한다.** [적용 현황의 Blog 목록](./support-matrix.md#타깃-blog-아이콘-소비처와-함께-바꿔야-할-배치)을 기준으로 공유 Button의 확장인지 별도 아이콘 primitive/recipe인지 비교한다. 제품에 아직 API를 추가하지 않았다. `asChild`, popup 상태·ref, placeholder, 포커스, Light/Dark를 함께 다룬다.
2. **실제 배치를 Storybook에서 먼저 비교한다.** 헤더의 검색·메뉴·테마·언어 및 같은 switcher를 쓰는 GraphToolbar를 함께 준비한다. 현재 28px 버튼의 간격을 유지한 채 44px overlay만 추가하면 타깃이 겹친다. C 표면/타깃 분리 원칙을 지키면서 44px 공간을 확보한 좁은 화면을 사용자가 확인한다.
3. **확인한 적용 단위로 제품을 이전한다.** 한 검색 버튼에 인라인으로 복제하지 않는다. 그래프 검색·필터·뒤로·닫기, 이미지 확대 닫기, Garden sidebar, 실제 footer의 RSS·minimal 소셜 링크와 compact recipe까지 현황표에서 누락 없이 추적한다. PR을 나누면 아직 바꾸지 않은 소비처를 미이전으로 남긴다.
4. **기존 누락과 검증 경계를 포함한다.** 그래프 검색 아이콘의 접근 가능한 이름을 보완하고, native button·Dialog/Sheet 기본 닫기 목록도 조사한다. 공통 Storybook 검사와 실제 제품의 비중첩·키보드·반응형·상태 검증을 함께 실행한다. 사용자 모바일 실습 선호만으로 제품 전체 검증을 대체하지 않는다.

실습은 [Learning / Button target size](http://127.0.0.1:6006/?path=/story/learning-button-target-size--compare&globals=locale:ko;theme:light)에서 다시 볼 수 있다. `pnpm --filter blog storybook`. 비교 조건·실행 결과·사용자 관찰은 [실습 기록](./button-target-size-lab.md)에 둔다. 실습의 표면 32px와 중심 간격 52px를 전체 제품 규격으로 고정하지 않는다.

## 이어서 정리할 기존 범위

- **Loading 후속 범위:** admin 대기 요청 6종은 공유 C로 이전했다. 복사는 기존 완료/오류 피드백을 유지하며 pending 모델 도입 필요성을 별도 판단한다. 폴더 이동은 동기 필터다. quant 새로고침·karaoke 가져오기/공유 등 다른 앱은 요청을 목록화한 뒤 공유 API로 이전하거나 역할 차이를 기록한다.
- **포커스 추가 검증:** 공유 컨트롤의 기본 이전은 끝났다. 갤러리 밖 Calendar·NavigationMenu·공유 Sidebar·ScrollArea·Resizable·Slider 배치와 메뉴 활성 행의 가시성을 확인한다. 제품별 theme 값 보존과 모든 배치의 대비 검증 완료를 혼동하지 않는다.
- **검증 보완:** loading의 실제 스크린리더 발화·정적인 대기 표시 인지, Button 밖의 reduced-motion, visual baseline을 후속으로 확인한다.
- **변경마다 적용 범위 갱신:** 공통 소스·소비처·테스트·현황표를 같은 변경에서 검토한다. 다른 앱으로 확대할 때 해당 앱의 목록과 배치를 먼저 조사한다.

## 보류와 기존 후속 단계

- 사진전 중심 홈 개편, 5분 설명 녹화·자기 비평, Figma Variables·component 대응은 보류한다. 지금 학습의 선행 조건이 아니다.
- 역할이 다른 token은 값이 같아도 조기 공통화하지 않는다. type/spacing token·전체 UI 카탈로그·token 생성 패키지·독립 배포는 현재 추가하지 않는다.
- `PostTags` 승격, D-009 viewport 구현, empty/state recipe, `SwitcherDropdown` 테스트, P-4 본문 읽기 비교는 기존 후속 단계에서 재평가한다.

이전 중단 기록은 [2026-09-18 checkpoint](./history/2026-09-18-checkpoint.md)에 보존한다. 단계 0의 설명·비평과 단계 1 전체를 완료로 표시하지 않는다.

---
name: blog-design-review
description: apps/blog의 Blog/Garden UI 일관성을 검토합니다. 카드·nav·검색·태그 패턴 drift, shared primitive 재사용, semantic token 사용, 반응형·다크모드·i18n·접근성을 점검할 때 사용합니다.
---

# Blog Design Review

`apps/blog`의 Blog/Garden UI 일관성을 검토하는 스킬입니다. 두 섹션은 같은 사이트의 sibling이므로 대응 화면은 정보 구조와 UI recipe를 의도적으로 공유해야 합니다.

기준 문서: `apps/blog/AGENTS.md`의 "UI / 디자인 Contract" 섹션. 이 스킬은 그 contract를 검토 체크리스트로 실행합니다.

## 언제 쓰나

- blog/garden 페이지, 카드, nav, 검색, 태그 UI를 추가·수정했을 때
- shared primitive(`ContentSegmentNav`, `ContentCard`, `SearchPalette` 등)를 바꿨을 때
- 라우팅/레이아웃/메타데이터 변경으로 양 섹션 경험이 갈라질 수 있을 때

## 검토 체크리스트

### 1. 정보 구조 drift

- blog/garden 대응 화면(index, 카드 리스트, 상세, 태그)의 정보 구조가 의도된 차이만 갖는가?
- 한쪽에만 추가된 surface(예: garden sidebar 검색, blog read-more)가 대응 섹션과 비교 검토되었는가?

### 2. Shared primitive 재사용

- segmented nav는 `ContentSegmentNav`(`shared/ui`)를 쓰는가? blog/garden 한쪽만 인라인 스타일을 들고 있지 않은가?
- 콘텐츠 카드는 `ContentCard` shell을 쓰고, 섹션별 차이를 `meta`/`tags`/`footer`/`description` 슬롯으로만 표현하는가?
- 반복되는 UI recipe가 인라인 복제 대신 `shared/ui`로 추출되었는가?

### 3. `data-slot` / selector

- shared primitive에 안정적인 `data-slot`이 있는가? (`content-segment-nav`, `content-card`)
- 테스트/리뷰가 텍스트나 구조 의존 selector 대신 `getByRole` + `data-slot`을 쓰는가?

### 4. Semantic token / 테마

- 색상이 semantic token(`bg-muted`, `text-muted-foreground`, `border-border`, `bg-background` 등)인가?
- raw 팔레트(`text-blue-*`, `bg-red-*`)나 임의 `dark:` 색상 override를 직접 쓰지 않는가?
- 임의 `z-[...]` 남용이 없는가?

### 5. 반응형

- 모바일/데스크톱에서 blog/garden이 동등한 경험을 주는가?
- 한쪽에만 모바일 보조 UI를 추가했다면 대응 섹션도 검토했는가?

### 6. i18n / 접근성

- 사용자 노출 문구가 `messages/{locale}.json`에서 오는가? (예외: garden `PARA_CATEGORIES` 영어 label은 의도된 하드코딩)
- 활성 nav 항목에 `aria-current="page"`가 적용되는가?
- nav/dialog/article landmark와 heading 흐름이 유지되는가?

## 출력 형식

발견 항목을 다음으로 분류해 보고합니다.

- **Drift**: blog/garden 간 의도치 않은 불일치
- **Reuse**: shared primitive로 흡수 가능한 인라인 복제
- **Token**: semantic token 위반(raw 색상, 임의 dark override)
- **A11y/i18n**: 접근성·번역 누락
- **Responsive**: 모바일/데스크톱 불일치

각 항목은 `파일:라인`, 문제, 권장 조치를 포함합니다. 코드 변경 전 검토 단계에서 쓰며, 실제 수정은 별도로 진행합니다.

## 정적 검사 연계

리뷰 전에 `pnpm --filter blog validate:design`을 돌리면 raw 색상, 임의 z-index, shared recipe 재인라인, `data-slot` 누락을 자동으로 잡는다. 이 스킬은 정적 검사가 못 잡는 정보 구조 drift, 반응형 동등성, i18n/접근성 같은 판단 영역을 보완한다.

## 관련 자산

- 정적 검사: `validate:design` (`apps/blog/scripts/validate-design-system.mjs`)
- 검증 절차 실행: `ci-preflight` 스킬
- 컴포넌트 생성 규칙: `react-component-generator` 스킬
- 완료 후 검증 범위 점검: `verifier` 서브에이전트

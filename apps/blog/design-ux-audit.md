# Blog UI/UX 일관성 조사 노트

작성일: 2026-06-06

이 문서는 `apps/blog`의 블로그/디지털 가든 UI 일관성, AI 개발 규약, 향후 자동화 하네스 후보를 정리한 작업 메모다. 이번 라운드에서는 코드 변경 없이 관찰과 제안만 기록한다.

## 조사 범위

주요 확인 파일:

- `apps/blog/app/[locale]/(main)/(content)/blog/page.tsx`
- `apps/blog/app/[locale]/(main)/(content)/blog/[category]/page.tsx`
- `apps/blog/app/[locale]/(main)/(content)/blog/[category]/[slug]/page.tsx`
- `apps/blog/app/[locale]/(main)/(content)/garden/page.tsx`
- `apps/blog/app/[locale]/(main)/(content)/garden/layout.tsx`
- `apps/blog/app/[locale]/(main)/(content)/garden/status/[status]/page.tsx`
- `apps/blog/app/[locale]/(main)/(content)/garden/[slug]/page.tsx`
- `apps/blog/src/widgets/blog-nav/ui/blog-nav.tsx`
- `apps/blog/src/widgets/garden-nav/ui/garden-nav.tsx`
- `apps/blog/src/widgets/post-card/ui/post-card.tsx`
- `apps/blog/src/widgets/note-card/ui/note-card.tsx`
- `apps/blog/src/widgets/garden-sidebar/ui/garden-sidebar.tsx`
- `apps/blog/src/shared/ui/search-palette.tsx`
- `apps/blog/mdx-components.tsx`
- `packages/ui/src/styles/globals.css`

## 현재 좋은 점

- `@mumak/ui/globals.css`의 semantic token 기반 테마를 사용한다.
- `@mumak/ui`의 shadcn/ui 기반 primitive를 적극 활용한다.
- 블로그/가든 모두 상세 페이지에서 `max-w-3xl`, `prose`, MDX 렌더링 패턴을 공유한다.
- `SearchPalette`, `SearchTrigger`를 공유해 검색 인터랙션 기반이 이미 정리되어 있다.
- `Skip to content`, `aria-current`, dialog role 등 접근성 기반 테스트와 구현이 존재한다.
- Playwright E2E가 블로그, 가든, navigation, theme, tags, SEO 등을 넓게 커버한다.

## 일관성 리스크

### 1. Blog index와 Garden index의 정보 구조 차이

`/blog`는 제목/설명, 카테고리 nav, 검색, 카드 리스트로 곧장 콘텐츠 탐색에 들어간다.

반면 `/garden`은 제목/노트 수, PARA 설명 prose, 카테고리 소개가 중심이고 실제 노트 탐색은 sidebar가 담당한다. 사용자는 두 섹션이 같은 사이트 안의 sibling인데도 서로 다른 진입 경험을 받을 수 있다.

후보 방향:

- `/garden`에도 최근 업데이트 노트, 상태별 요약, 대표 노트 카드 같은 content surface를 제공한다.
- 또는 `Blog = chronological stream`, `Garden = knowledge map/sidebar`라는 차이를 hero copy에서 더 명확히 설명한다.

### 2. `BlogNav`와 `GardenNav`의 중복 recipe

`BlogNav`와 `GardenNav`는 거의 같은 segmented nav 스타일을 각자 들고 있다.

현재는 일관적이지만 한쪽만 수정될 경우 drift가 발생하기 쉽다.

후보 방향:

- `ContentSegmentNav` 같은 shared primitive로 추출한다.
- blog/garden은 item 목록과 active 판정만 넘긴다.
- 공통 `data-slot="content-segment-nav"`를 두면 테스트/리뷰 기준도 잡기 쉽다.

### 3. `PostCard`와 `NoteCard`의 정보 밀도 차이

공통 패턴:

- border, rounded, padding
- hover background
- active scale
- tag 표시

차이:

- `PostCard`: category, date, reading time, description
- `NoteCard`: status, date, outgoing link count, tags
- `NoteCard`에는 excerpt/summary가 없다.

후보 방향:

- `getNoteEmbedPreview` 같은 기존 API를 활용해 `NoteCard`에도 짧은 excerpt를 제공한다.
- 카드 shell은 공유하고 metadata slot만 다르게 구성한다.

### 4. 검색 진입점 위치 차이

- Blog search: 상단 nav row 오른쪽
- Garden search: sidebar 내부, 모바일에서는 icon button

기능은 공유되지만 사용자가 검색 위치를 다르게 학습해야 한다.

후보 방향:

- 검색 trigger 위치 규칙을 `apps/blog/AGENTS.md` 또는 별도 design guide에 명시한다.
- `/garden` main content에도 보조 검색 trigger를 둘지 검토한다.

### 5. Garden sidebar category label의 i18n 정책

`apps/blog/app/[locale]/(main)/(content)/garden/layout.tsx`의 `PARA_CATEGORIES`는 영어 label을 하드코딩한다.

PARA 용어를 영어로 유지하는 의도라면 규칙으로 명시한다. 아니라면 `messages/{locale}.json`으로 이동해 locale별 label을 사용한다.

## AI 개발 규약 제안

### 1. `apps/blog/AGENTS.md`에 디자인 contract 추가

추가할 만한 섹션:

- Blog/Garden page contract
- list/card/nav/search 패턴
- MDX/prose typography 기준
- responsive layout 기준
- dark/light theme token 사용 규칙
- UI 변경 시 필요한 E2E/visual/a11y 검증 기준

### 2. `react-component-generator` 스킬 정비

현재 `.ai/skills/react-component-generator/SKILL.md`는 일부 내용이 실제 blog 구조와 다르다.

- Blog 전용 위치를 `apps/blog/components/`로 안내하지만, 실제는 FSD 기반 `apps/blog/src/widgets`, `features`, `entities`, `shared` 구조다.
- Props 정의에서 `interface`를 기본 권장하지만 루트 규칙은 `React.ComponentProps<>` 우선이다.
- `cn` import 예시가 현재 프로젝트 패턴과 다르다.

향후 UI 작업 전에 이 스킬을 프로젝트 규칙에 맞게 업데이트하는 것이 좋다.

### 3. `blog-design-review` 스킬 추가 후보

위치 후보: `.ai/skills/blog-design-review/SKILL.md`

검토 항목:

- blog/garden 대응 화면의 정보 구조 drift
- shared primitive 재사용 여부
- semantic token 사용 여부
- 모바일/데스크톱 레이아웃 일관성
- 검색, 태그, nav, card 패턴 일관성
- i18n copy와 접근성 label 점검

### 4. `design-reviewer` 서브에이전트 추가 후보

위치 후보: `.ai/agents/design-reviewer.md`

구현 후 다음 관점으로 리뷰한다.

- 시각적 일관성
- 정보 구조
- 접근성
- 반응형
- 다크모드
- i18n copy
- blog/garden 간 괴리

Copilot 전용 pointer는 현재 사용할 계획이 없으므로 추가하지 않는다.

## 자동화 하네스 후보

### 1. Playwright visual regression

현재 E2E는 기능 검증 중심이고 `toHaveScreenshot` 기반 visual regression은 없다.

초기 canonical page 후보:

- `/ko/blog`
- `/ko/garden`
- `/ko/blog/essay/first`
- `/ko/garden/digital-garden-and-pkm`
- 모바일 `/ko/blog`
- 모바일 `/ko/garden`

권장 시작 방식:

- Chromium 단일 project에서 시작한다.
- 처음에는 non-blocking 또는 수동 검증으로 둔다.
- 폰트/OS/렌더링 차이로 flaky가 안정화된 뒤 required로 승격한다.

### 2. Axe accessibility scan

`@axe-core/playwright`를 추가해 주요 페이지의 자동 접근성 검사를 붙일 수 있다.

우선 대상:

- `main`
- `nav`
- `dialog`
- `article`
- search palette
- mobile sheet/sidebar

CI check 수를 늘리지 않으려면 별도 workflow 대신 기존 `blog` E2E 안에 포함하는 편이 낫다.

### 3. `validate:design` 정적 검사

가벼운 Node script로 시작 가능하다.

검사 후보:

- raw Tailwind color 금지: `text-blue-*`, `bg-red-*` 등
- 임의 z-index 제한: `z-[999]` 등
- 직접 `dark:` 색상 override 제한
- 공통 UI recipe drift 탐지: `BlogNav`/`GardenNav`, `PostCard`/`NoteCard`
- 공통 slot naming 누락 탐지

위치 후보:

- `apps/blog/scripts/validate-design-system.mjs`
- `apps/blog/package.json`에 `validate:design` 추가
- 기존 `CI`의 `Validate (blog)` 내부에 포함하면 새 GitHub check를 늘리지 않고 검증 가능

## 추천 작업 순서

1. `apps/blog/AGENTS.md`에 디자인 contract 추가
2. stale한 `.ai/skills/react-component-generator/SKILL.md` 정비
3. `.ai/skills/blog-design-review/SKILL.md` 초안 추가
4. `BlogNav`/`GardenNav` 공통 primitive 추출
5. `PostCard`/`NoteCard` 카드 shell/metadata 패턴 정렬
6. visual regression 또는 axe 하네스 중 하나를 작게 도입

## 이번 문서에서 의도적으로 하지 않은 것

- 실제 UI 컴포넌트 변경
- visual snapshot baseline 생성
- axe dependency 추가
- GitHub Copilot pointer 추가

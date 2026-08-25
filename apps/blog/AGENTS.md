# apps/blog — AGENTS.md

블로그 앱 전용 규칙. 공통 규칙은 루트 `AGENTS.md` 참조.

---

## Feature-Sliced Design 구조

```
apps/blog/src/
├── app/        # 앱 레벨 (providers, analytics, seo)
├── entities/   # 도메인 엔티티 (post, spotify, social)
├── features/   # 기능 모듈 (switch-theme, spotify-polling)
├── widgets/    # 복합 UI (header, footer, post-card)
└── shared/     # 공유 유틸 (config, hooks, lib, ui)
```

## 모듈 내부 구조

각 모듈은 다음 구조를 따른다.

```
src/widgets/post-card/
├── __tests__/
│   └── post-card.test.tsx
├── ui/
│   └── post-card.tsx
└── index.ts              # barrel export
```

## 네이밍

- 폴더: kebab-case (`post-card`, `switch-theme`) — 루트와 동일
- 컴포넌트 파일: kebab-case (`post-card.tsx`) — 루트와 동일, `ui/` 내부도 동일
- 컴포넌트 export 이름은 PascalCase named export (`export function PostCard`)
- 테스트 파일: kebab-case (`post-card.test.tsx`) — 루트와 동일

## FSD Import 규칙

레이어 간 import는 **위에서 아래로만** 허용한다.

```
app → widgets → features → entities → shared
```

같은 레이어 간 cross-import는 금지.

```typescript
// Good: widgets에서 entities 사용
import { Post } from '@/src/entities/post';

// Bad: entities에서 widgets 사용
import { PostCard } from '@/src/widgets/post-card';
```

---

## MDX 블로그 Frontmatter

`apps/blog/content/{locale}/{articles,essay,notes}/` 하위 MDX 파일에 필수.

```yaml
---
title: '포스트 제목'
date: '2025-01-27'
description: '포스트 설명'
tags: ['tag1', 'tag2']
draft: false # 생략 시 false
---
```

---

## Digital Garden 콘텐츠

### 파일 위치

```
apps/blog/content/
├── ko/garden/   # 한국어 노트
└── en/garden/   # 영어 노트
```

### Frontmatter 필수 필드

```yaml
---
title: '노트 제목'
created: '2026-02-04' # 생성일 (YYYY-MM-DD)
updated: '2026-02-04' # 수정일 (선택, 수정 시 추가)
status: 'seedling' # seedling | budding | evergreen
tags: ['tag1', 'tag2']
draft: false # 생략 시 false
---
```

### Status 의미

| Status      | 의미   | 설명                               |
| ----------- | ------ | ---------------------------------- |
| `seedling`  | 씨앗   | 초기 아이디어, 미완성 메모         |
| `budding`   | 새싹   | 발전 중인 생각, 어느 정도 구체화됨 |
| `evergreen` | 상록수 | 성숙하고 다듬어진 완성된 노트      |

### Wikilink 문법 (Obsidian 호환)

```mdx
기본 링크: [[note-slug]]
레이블 링크: [[note-slug|표시할 텍스트]]

예시:
이 주제는 [[philosophy-of-mind]]와 연결됩니다.
자세한 내용은 [[ai-survival|AI 시대 생존법]]을 참고하세요.
```

### 파일명 규칙

- **kebab-case** 사용: `my-note-title.mdx`
- 영문 소문자 + 하이픈
- 공백, 특수문자 사용 금지

### Obsidian 연동

`apps/blog/content/ko/garden/` 폴더를 Obsidian vault로 열어서 편집 가능.

1. Obsidian → Open folder as vault
2. Settings → Files & Links → Detect all file extensions 활성화
3. `[[wikilink]]` 문법으로 노트 연결

### 예시

```mdx
---
title: '존재란 무엇인가'
created: '2026-01-15'
status: 'budding'
tags: ['philosophy', 'thought']
---

존재에 대한 질문은 [[being-and-time|하이데거]]에서 시작된다.

## 핵심 개념

현존재(Dasein)는...

## 관련 노트

- [[phenomenology]]
- [[existentialism|실존주의]]
```

---

## 콘텐츠 GEO 관행 (AI 검색·인용 최적화)

코드 인프라(JSON-LD, hreflang, sitemap, RSS full-content, `.md` 원문 엔드포인트, OG 이미지)는 이미 갖춰져 있다. GEO의 나머지 절반은 **콘텐츠 구조**다. AI 검색·어시스턴트는 질문-답 구조, 명시적 요약, 정확한 갱신일을 가진 문서를 더 잘 발견하고 인용한다. 새 글·노트를 쓸 때 아래를 권장한다(강제는 아니다).

- **상단 요약(TL;DR)**: 글 도입부에 2~3문장으로 결론·핵심을 먼저 제시한다. AI가 인용 단위로 끌어가기 쉽고, description/excerpt와도 일관된다.
- **질문형 헤딩**: 핵심 섹션 제목을 "왜 X인가", "X를 어떻게 하나"처럼 질문형으로 두면 AI 검색의 질의-응답 매칭에 유리하다.
- **갱신일 관리**: 내용을 고치면 frontmatter `updated`(garden) / `date`(blog)를 갱신한다. 이미 JSON-LD `dateModified`와 sitemap `lastModified`로 연결되는 파이프라인이 완비돼 있어, 갱신일만 정확히 유지하면 신선도 신호가 자동으로 흐른다.
- **FAQPage 스키마(선택)**: Q&A 성격이 강한 글은 `src/app/seo`에 FAQPage 구조화 데이터 추가를 검토한다. 일반 글에는 불필요하다.

---

## UI / 디자인 Contract

Blog와 Garden은 같은 사이트의 sibling 섹션이다. 두 섹션의 대응 화면은 **정보 구조와 UI recipe를 의도적으로 공유**하고, drift가 생기면 shared primitive로 흡수한다.

### Blog / Garden 페이지 대응 관계

| 영역          | Blog                                  | Garden                                          | 공유 방식                         |
| ------------- | ------------------------------------- | ----------------------------------------------- | --------------------------------- |
| index 골격    | header → nav → 카드 리스트            | header → PARA overview → nav → 최신 노트 리스트 | `PageHeader` + `ContentCard`      |
| 페이지 헤더   | `PageHeader`                          | `PageHeader`                                    | `PageHeader` (`shared/ui`)        |
| segmented nav | `BlogNav` (전체/카테고리/태그)        | `GardenNav` (전체/status/태그)                  | `ContentSegmentNav` (`shared/ui`) |
| 분류 진입점   | BlogNav 카테고리 → `/blog/[category]` | PARA overview 카드 → `/garden/category/[key]`   | "분류 클릭 → 필터된 카드 리스트"  |
| 카드          | `PostCard`                            | `NoteCard` (excerpt 포함)                       | `ContentCard` shell (`shared/ui`) |
| 상세 페이지   | `max-w-3xl` + `prose` + MDX           | `max-w-3xl` + `prose` + MDX                     | 동일 레이아웃 패턴 유지           |
| 상세 하단     | `LinkedNotesSection` + `NextReading`  | `LinkedNotesSection`                            | `LinkedNotesSection` (`widgets/`) |
| 검색          | 헤더 전역 팔레트 (섹션 검색창 없음)   | 헤더 전역 팔레트 (섹션 검색창 없음)             | `features/site-search`            |

- 상세 하단의 `LinkedNotesSection`은 blog/garden이 공유한다. 항목이 자기 `href`를 들고 오므로 한 목록에 가든 노트와 블로그 글을 섞을 수 있다. 위키링크는 가든 안에서만 통하는 주소라 두 섹션을 잇는 링크는 본문의 표준 마크다운 링크로만 표현되고, 그 방향을 양쪽에서 되짚은 결과가 이 목록이다. 섹션 라벨은 `garden.linkedNotes`를 공유하고, 방향 라벨만 주어가 달라서 갈린다(`garden.linkDirection.*` / `post.linkDirection.*`).
- `NextReading`(태그 겹침 기반 이어 읽기)은 블로그에만 있다. 가든은 노트 그래프 자체가 그 역할을 하고, 노트에는 카테고리 목록으로 내려가는 대응 동선도 이미 있다. 의도된 비대칭이다.
- 검색은 섹션별 진입점이 아니라 헤더의 단일 전역 팔레트(`features/site-search`)가 담당한다. 글과 노트를 한 인덱스(`/{locale}/search-index.json`의 `posts` + `notes`)에서 함께 찾고, `/blog`·`/garden` 안에서 열면 해당 섹션으로 프리필터된 뒤 "전체에서 검색"으로 넓힌다. 헤더는 모든 페이지에 있으므로 가든 레이아웃 payload에 의존할 수 없어서 노트도 정적 인덱스에 실린다. 섹션 화면에 검색창을 다시 추가하지 않는다.
- 홈은 "최신 글"과 "최신 노트"(`widgets/garden-highlights`)를 같은 `h2` 위계의 대응 블록으로 유지한다. 홈에서 가든이 빠지면 콘텐츠 대부분이 내비게이션 라벨 하나 뒤에 숨는다.
- 두 블록의 헤딩은 같은 축("최신 + 대상")으로 맞춘다. 한쪽만 장소("가든에서")나 다른 축으로 이름을 붙이면 똑같이 생긴 두 블록이 왜 갈렸는지 읽히지 않는다.
- 성장 상태(`seedling`/`budding`/`evergreen`) 배지는 가든 내부 화면에서만 쓰고 홈에는 노출하지 않는다. 실제로 관리되는 축이 아니라서(evergreen 0) 홈에서 광고하면 없는 편집 관행을 약속하는 셈이 된다.
- Garden index의 1순위 결정은 PARA 분류다. 그래서 index에서는 PARA overview가 `GardenNav`보다 먼저 오고, `GardenNav`는 자기가 걸러내는 "최신 노트" 목록 바로 위에 놓여 페이지 주 내비게이션이 아니라 그 목록의 필터로 읽힌다. status/tags 필터 페이지에서는 `GardenNav`가 그대로 최상단에 온다(그 화면에서는 실제로 주 컨트롤이다).
- `GardenNav`는 노트가 0건인 status 세그먼트를 감춘다(현재 보고 있는 status는 예외). 라우트는 살아 있어서 직접 링크는 열리지만, 빈 목록으로만 이어지는 항목에 nav 자리를 주지 않는다.
- Garden index와 category/status 페이지는 `GardenNav`를 공유한다. `GardenNav`의 세그먼트 축은 status이므로 `/garden/category/[key]`에서는 활성 세그먼트가 없다(분류축이 다른 의도된 차이). 카테고리 컨텍스트는 `PageHeader`(label + 설명)가 제공한다.
- `/garden/category/[key]`의 PARA label은 사이드바와 동일하게 영어로 유지하고(`PARA_LABELS`), 설명은 `garden.categories.{key}.description`을 재사용한다.

### Shared primitive 우선 원칙

- segmented nav를 새로 만들거나 수정할 때는 `ContentSegmentNav`를 쓴다. blog/garden 한쪽만 인라인으로 스타일을 바꾸지 않는다.
- 콘텐츠 카드(카테고리/날짜/태그 메타 + 제목 + 본문 슬롯)는 `ContentCard` shell을 쓰고, 섹션별로 다른 부분은 `meta`/`tags`/`footer`/`description` 슬롯으로만 표현한다.
- 리스트/인덱스 페이지의 페이지 제목+설명은 `PageHeader`(`shared/ui`)를 쓴다. `h1`을 페이지마다 인라인으로 스타일링하지 않는다.
- 인터랙티브 카드 표면(border + elevation + hover/active 거동)은 `cardSurfaceClass`(`shared/ui`)를 합성한다. `ContentCard`와 `GardenOverview` 타일이 이 단일 recipe를 공유하고, padding만 사용처에서 더한다.
- 두 섹션에서 반복되는 UI recipe를 발견하면 인라인 복제 대신 `shared/ui`로 추출한다.

### `data-slot` 규칙

- shared UI primitive에는 안정적인 `data-slot`을 부여해 테스트/리뷰 anchor로 쓴다.
  - segmented nav: `data-slot="content-segment-nav"`
  - 콘텐츠 카드: `data-slot="content-card"`
- 텍스트(번역 문구)나 구조 의존 selector 대신 `getByRole` + `data-slot`을 우선한다.

### 토큰 / 테마 / 반응형

- 색상은 항상 semantic token(`bg-muted`, `text-muted-foreground`, `border-border`, `bg-background` 등)을 쓴다. raw Tailwind 팔레트(`text-blue-500`, `bg-red-*`)와 임의 `dark:` 색상 override를 직접 쓰지 않는다.
- 다크/라이트는 token으로 자동 대응한다. 컴포넌트에서 테마별 분기 색상을 하드코딩하지 않는다.
- 임의 `z-[...]` 값 남용을 피하고, 레이아웃은 Tailwind 빌트인 스케일로 표현한다.
- 모바일/데스크톱 레이아웃은 blog/garden 간 동등한 경험을 목표로 한다. 한쪽에만 모바일 보조 UI(예: sidebar 검색)를 추가하면 대응 섹션도 함께 검토한다.

### i18n / 접근성

- 사용자에게 보이는 문구는 `messages/{locale}.json`에서 가져온다.
  - 예외: Garden sidebar의 `PARA_CATEGORIES` label은 PARA 용어를 영어로 유지하는 의도된 하드코딩이다. 이 정책을 바꾸려면 먼저 문서화한다.
- 활성 nav 항목은 `aria-current="page"`로 표시한다(`ContentSegmentNav`가 처리).
- nav/dialog/article landmark와 heading 흐름을 유지한다.

### UI 변경 시 검증 기준

- 단위 테스트: 영향받는 widget/primitive의 `__tests__`를 갱신한다. shared primitive 변경은 blog/garden 양쪽 테스트가 모두 그린이어야 한다.
- E2E: 라우팅·레이아웃·nav·card·검색·메타데이터 변경 시 `e2e/**` 영향 범위를 검토한다.
- 정적 검사: `pnpm --filter blog validate:design`으로 raw 색상·임의 z-index·recipe drift·data-slot 누락을 점검한다. CI `Validate (blog)` job에 포함된다(새 GitHub check 없음).
- preflight: `check-types → lint → format:check → test:ci` 순서를 지킨다.

### 알려진 follow-up

- `NoteCard` excerpt는 적용됨(`NoteMeta.excerpt` = 첫 문단, 카드에서 `line-clamp-2`로 truncate).
- axe 접근성 스캔은 도입됨(`e2e/a11y.spec.ts`, WCAG 2.1 A/AA 7개 시나리오). 상세 페이지는 `.prose`를 제외한다.
- visual regression(`toHaveScreenshot`)은 미도입. 도입 시 기존 `blog` E2E 안에 포함해 새 GitHub check를 늘리지 않는다.
- 디자인시스템 작업의 기준선·지원 범위·예외·결정 기록은 `docs/design-system/`에 있다. 계획은 `apps/blog/plan.md`.
- 확인된 미해결 결함: light 모드 `--ring` 대비 2.82:1(비텍스트 최소치 3:1 미달). axe는 포커스 표시 대비를 평가하지 않아 스캔이 통과해도 남는다. `docs/design-system/audit.md` 참조.

---

## E2E

- 이 앱은 `output: standalone` 기준으로 실행.
- 로컬 E2E 실패 시 `apps/blog/.next` 상태를 우선 확인.

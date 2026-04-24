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
│   └── PostCard.tsx      # PascalCase (FSD ui/ 내부만 예외)
└── index.ts              # barrel export
```

## 네이밍 (루트 규칙 대비 차이점)

- 폴더: kebab-case (`post-card`, `switch-theme`) — 루트와 동일
- **`ui/` 디렉터리 내 컴포넌트 파일만 PascalCase** (`PostCard.tsx`)
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

## MDX 포스트 Frontmatter

`apps/blog/content/{locale}/posts/` 하위 MDX 파일에 필수.

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
apps/blog/content/{locale}/garden/
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

## E2E

- 이 앱은 `output: standalone` 기준으로 실행.
- 로컬 E2E 실패 시 `apps/blog/.next` 상태를 우선 확인.
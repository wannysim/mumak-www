# Wan Sim Blog

Next.js App Router + TypeScript + next-intl로 구성된 다국어 MDX 블로그입니다.

## 주요 기능

- **다국어 지원**: 한국어/영어 지원
- **MDX 콘텐츠**: 마크다운 + React 컴포넌트
- **블로그 콘텐츠**: essay, articles, notes
- **Digital Garden**: PARA 기반 garden 노트와 wikilink
- **SEO 최적화**: sitemap.xml, robots.txt, manifest, metadata
- **반응형 디자인**: Tailwind CSS + `@mumak/ui`

## 기술 스택

| 구분        | 기술                                  |
| ----------- | ------------------------------------- |
| Framework   | Next.js App Router                    |
| i18n        | next-intl                             |
| MDX         | next-mdx-remote-client                |
| Frontmatter | gray-matter                           |
| Styling     | Tailwind CSS, @tailwindcss/typography |
| UI          | @mumak/ui (shadcn/ui 기반)            |
| Unit Test   | Jest + React Testing Library          |
| E2E Test    | Playwright                            |

## 개발 환경

- Node.js 24.11.1+
- pnpm

## 설치 및 실행

의존성은 워크스페이스 루트에서 설치합니다.

```bash
pnpm install
```

루트에서 실행할 때:

```bash
pnpm --filter=blog dev
pnpm --filter=blog build
pnpm --filter=blog start
```

앱 디렉터리에서 실행할 때:

```bash
pnpm dev
pnpm build
pnpm start
```

개발 서버는 Portless를 사용하며 기본 URL은 `http://blog.mumak.localhost:1355`입니다.
E2E/CI용 start 포트는 `3002`입니다.

## 검증

```bash
# 단위 테스트
pnpm test
pnpm test:coverage
pnpm test:ci

# E2E 테스트
pnpm test:e2e
pnpm test:e2e:ui
pnpm test:e2e:headed
pnpm test:e2e:debug

# 콘텐츠 검증
pnpm validate:content
pnpm validate:garden
```

루트에서 특정 앱만 검증하려면 filter를 사용합니다.

```bash
pnpm --filter=blog test:ci
pnpm --filter=blog test:e2e
pnpm --filter=blog validate:content
pnpm --filter=blog validate:garden
```

## 프로젝트 구조

```text
apps/blog/
├── app/                         # Next.js route tree
│   ├── [locale]/
│   │   ├── (main)/              # 일반 페이지 레이아웃
│   │   ├── (immersive)/         # graph 등 몰입형 화면
│   │   ├── feed.xml/route.ts
│   │   ├── layout.tsx
│   │   └── not-found.tsx
│   ├── api/spotify/             # Spotify API route
│   ├── manifest.ts
│   ├── robots.ts
│   └── sitemap.ts
├── content/                     # MDX 콘텐츠
│   ├── ko/{articles,essay,notes,garden}/
│   └── en/{articles,essay,notes,garden}/
├── messages/                    # i18n 메시지
├── src/
│   ├── app/                     # providers, analytics, seo
│   ├── entities/                # post, note, tag, spotify 등
│   ├── features/                # graph, switch-theme 등
│   ├── shared/                  # config, hooks, lib, ui
│   └── widgets/                 # header, nav, cards, footer 등
├── __tests__/                   # route/static 단위 테스트
├── e2e/                         # Playwright E2E 테스트
├── mdx-components.tsx
├── proxy.ts
└── scripts/
```

## 콘텐츠 작성

### 블로그 글

블로그 글은 `content/{locale}/{category}/` 아래에 `.mdx` 파일로 작성합니다.
현재 블로그 카테고리는 `articles`, `essay`, `notes`입니다.

```mdx
---
title: '글 제목'
date: '2024-12-03'
description: '글 요약'
tags: ['tag1', 'tag2']
draft: false
---

본문 내용...
```

### Digital Garden 노트

Garden 노트는 `content/{locale}/garden/` 아래에 작성합니다.

```mdx
---
title: '노트 제목'
created: '2026-02-04'
updated: '2026-02-04'
status: 'seedling'
tags: ['tag1', 'tag2']
draft: false
---

관련 노트는 [[note-slug]] 또는 [[note-slug|표시할 텍스트]]로 연결합니다.
```

### Frontmatter

| 필드        | 블로그 글 | Garden 노트 | 설명                               |
| ----------- | --------- | ----------- | ---------------------------------- |
| title       | 필수      | 필수        | 제목                               |
| date        | 필수      | -           | 블로그 글 작성일 (`YYYY-MM-DD`)    |
| description | 필수      | -           | 블로그 글 요약                     |
| created     | -         | 필수        | Garden 노트 생성일 (`YYYY-MM-DD`)  |
| updated     | -         | 선택        | Garden 노트 수정일 (`YYYY-MM-DD`)  |
| status      | -         | 필수        | `seedling`, `budding`, `evergreen` |
| tags        | 선택      | 선택        | 태그 배열                          |
| draft       | 선택      | 선택        | `true`면 production에서 제외       |

## 컨벤션

앱 전용 구조와 작성 규칙은 [`AGENTS.md`](./AGENTS.md)를 따릅니다.

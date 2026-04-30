# AGENTS.md

이 저장소에서 작업하는 모든 AI 코딩 에이전트(Cursor · Codex · Claude Code · Aider · Zed · Copilot · Gemini CLI · Windsurf 등)가 공통으로 참조하는 단일 진입점.

- 공식 표준: [agents.md](https://agents.md/) (Linux Foundation · Agentic AI Foundation)
- Claude Code는 루트 `CLAUDE.md`가 이 파일을 `@import`해서 동일한 내용을 읽는다.
- 하위 디렉터리(`apps/*`, `packages/*`)에 `AGENTS.md`가 있으면 **가장 가까운 것**이 우선한다 (nested AGENTS.md).

---

## 리포지토리 자산 구조

| 위치                                        | 역할                                                              | 공유 대상                     |
| ------------------------------------------- | ----------------------------------------------------------------- | ----------------------------- |
| `AGENTS.md` (루트 · 현재 파일)              | 모든 에이전트 공통 규칙                                           | Cursor, Codex, Aider, Zed, …  |
| `apps/*/AGENTS.md`, `packages/*/AGENTS.md`  | 해당 패키지/앱에 국한된 규칙 (nested)                             | 동일. 가장 가까운 파일이 우선 |
| `CLAUDE.md` (루트)                          | `@AGENTS.md` 한 줄 어댑터 + Claude Code 전용 섹션                 | Claude Code                   |
| `.ai/skills/*/SKILL.md`                     | 프로젝트 공유 스킬 (실체)                                         | Cursor · Codex · Claude Code  |
| `.ai/agents/*.md`                           | 프로젝트 특화 서브에이전트 (실체)                                 | Cursor · Claude Code          |
| `.cursor/skills → ../.ai/skills` (symlink)  | Cursor가 스킬을 읽는 경로                                         | Cursor                        |
| `.cursor/agents → ../.ai/agents` (symlink)  | Cursor가 서브에이전트를 읽는 경로                                 | Cursor                        |
| `.claude/skills → ../.ai/skills` (symlink)  | Claude Code가 Agent Skills를 읽는 경로                            | Claude Code                   |
| `.claude/agents → ../.ai/agents` (symlink)  | Claude Code가 서브에이전트를 읽는 경로                            | Claude Code                   |
| `.cursor/hooks.json`, `.cursor/hooks/*.mjs` | edit-reminder / shell-guard 훅 (Cursor 전용 기능, 대응 표준 없음) | Cursor                        |
| `.cursor/mcp.json`                          | Cursor MCP 서버 설정                                              | Cursor                        |
| `~/.ai-skills/{skills,agents}`              | 개발자 개인 user-level 자산 (전 프로젝트 공통)                    | Cursor · Codex · Claude Code  |

### 규칙

- **스킬·서브에이전트의 단일 소스는 `.ai/`**. `.cursor/`·`.claude/` 하위는 symlink이므로 직접 수정하지 말 것.
- **동일 이름의 스킬이 user(`~/.ai-skills`)와 project(`.ai/`) 양쪽에 있으면 project 버전이 우선**.
- **공통 규칙은 이 파일(또는 nested `AGENTS.md`)에만 적는다.** `.cursor/rules/*.mdc`에 복제하지 않는다. (nested `AGENTS.md` + path-scoped frontmatter로 대체)
- 새 AI provider 도입 시: 해당 provider가 `AGENTS.md`를 읽는지 먼저 확인하고, 못 읽으면 포인터 파일만 추가한다.

### 자주 쓰이는 스킬

- `ci-preflight` — `check-types → lint → format:check → test:ci` 로컬 검증 순서
- `turborepo` — Turborepo 필터 문법, 캐시 관리
- `shadcn` — shadcn/ui 컴포넌트 설치·커스터마이즈
- `react-component-generator` — 새 컴포넌트 스캐폴딩
- `test-writer` — Jest · Vitest · Playwright 테스트 작성
- `release` — Git Flow 기반 버전 관리
- `expressive-refactor` — 이름·구조 중심 리팩토링
- `perf-optimization` — 성능 최적화 체크리스트

### 서브에이전트 (위임용)

- `verifier` — 완료 주장과 실제 검증 사이의 누락 점검 (구현 완료 후)
- `debugger` — 실패 로그가 길거나 원인이 불명확한 에러의 근본 원인 분석

---

## 프로젝트 개요

Turborepo 기반 모노레포. 공유 패키지는 `packages/`, 앱은 `apps/`에 위치.

| 패키지                     | 용도                         |
| -------------------------- | ---------------------------- |
| `@mumak/ui`                | shadcn/ui 기반 공유 컴포넌트 |
| `@mumak/typescript-config` | TypeScript 설정              |

| 앱                 | 설명                    |
| ------------------ | ----------------------- |
| `apps/mumak-next`  | Next.js 15 (App Router) |
| `apps/mumak-react` | React + Vite            |
| `apps/blog`        | 블로그 (FSD + MDX)      |

각 앱/패키지의 세부 규칙은 해당 디렉터리의 `AGENTS.md`를 참조.

---

## Git Flow

- `main`: 프로덕션, `develop`: 개발 통합
- `feature/*`: `develop`에서 분기 → `develop`으로 머지
- `hotfix/*`: `main`에서 분기 → `main`, `develop` 둘 다 머지

---

## 네이밍 컨벤션

- 폴더명: **kebab-case** (`post-card`, `switch-theme`)
- 파일명: **kebab-case** (`counter.tsx`, `theme-provider.tsx`)
- 테스트 파일: `*.test.ts(x)`, E2E는 `*.spec.ts`
- 설정 파일: kebab-case (`jest.config.mjs`, `vite.config.ts`)
- FSD `ui/` 디렉터리 내 컴포넌트 파일만 예외적으로 **PascalCase** (`PostCard.tsx`) — `apps/blog/AGENTS.md` 참조

### 테스트 폴더 구조

- 단위 테스트: 소스와 colocate된 `__tests__/` 폴더
- E2E 테스트: 프로젝트 루트의 `e2e/` 폴더

```
src/
├── components/
│   └── counter.tsx
├── __tests__/
│   └── counter.test.tsx
e2e/
└── home.spec.ts
```

---

## TypeScript

- 의미 있는 함수/변수 이름을 주석보다 우선한다.
- 대규모 변경 시 `knip`으로 미사용 코드를 제거한다.
- `any`로 캐스팅하지 않는다.

---

## Import 패턴

### 절대경로 우선

- 항상 절대경로를 사용: `@/`, `@/src/` alias
- 모노레포 패키지: `@mumak/ui/...`

```typescript
// Good
import { Counter } from '@/components/counter';
import { formatDate } from '@/src/shared/lib/date';
import { Button } from '@mumak/ui/components/button';

// Bad
import { Counter } from '../components/counter';
import { Button } from '../../packages/ui/src/components/button';
```

### 상대경로 허용 예외

- 같은 모듈 내부 sibling import
- 테스트 파일에서 테스트 대상 import

```typescript
// 같은 모듈 내부 (허용)
import { PostCard } from '../ui/PostCard';

// 테스트 파일 (허용)
import { Counter } from '../components/counter';
```

### Import 순서

1. React / 외부 라이브러리
2. 모노레포 패키지 (`@mumak/*`)
3. 절대경로 내부 모듈 (`@/`, `@/src/`)
4. 상대경로 (필요시)
5. CSS / 스타일

```typescript
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@mumak/ui/components/button';

import { useAuth } from '@/hooks/use-auth';
import { formatDate } from '@/lib/date';

import '@mumak/ui/globals.css';
import './styles.css';
```

---

## React 컴포넌트 패턴

### Export

- 재사용 컴포넌트는 **named export**
- Next.js 페이지/레이아웃, 설정 파일만 **default export**

```typescript
// Good
export function Counter() { ... }
export function ThemeProvider({ children }: ...) { ... }

// Bad (일반 컴포넌트)
export default function Counter() { ... }

// Good (Next.js 페이지)
export default function Page() { ... }
export default function RootLayout({ children }: ...) { ... }
```

### Props

- **`React.ComponentProps<>`** 로 props 타이핑 — 별도 `interface` 정의 지양

```typescript
// Good
function Button({
  className,
  variant,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  // ...
}

// Bad
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive';
}
function Button({ className, variant, ...props }: ButtonProps) { ... }
```

### 구조

```typescript
'use client'; // 필요시

import * as React from 'react';
import { cn } from '@mumak/ui/lib/utils';

const variants = cva(...); // variants 먼저

function Component({ className, ...props }: ...) {
  // hooks
  // handlers
  // render
}

export { Component, variants }; // 파일 끝에서 export
```

### 기타

- 거대한 JSX 블록을 피하고 작은 컴포넌트로 쪼갠다.
- 함께 변하는 코드는 colocate한다.
- `useEffect`는 꼭 필요할 때만 사용한다.

---

## Next.js

- RSC에서 데이터 페칭을 우선한다.
- RSC → 클라이언트 컴포넌트로 내려가는 prop의 직렬화 크기에 주의한다.
- `next/image`의 `priority`는 LCP 이미지에만 사용한다.

---

## Tailwind

- v4 + shadcn/ui만 사용한다.
- 대부분 빌트인 값으로 표현하고, 글로벌 CSS는 최소화한다.

---

## 테스트 작성 규칙

### 기본 원칙

- 기능을 수정하거나 회귀 위험이 있는 리팩토링을 했다면, 테스트 추가/수정 필요성을 항상 검토한다.
- 테스트 파일만 작성하고 실행하지 않은 채 끝내지 않는다.
- "테스트가 있었음"보다 "이번 변경을 실제로 막아주는 테스트인지"를 우선한다.
- 동작 변경이 없다고 주장하는 리팩토링일수록 회귀를 더 의심한다.

### 네이밍

- 단위 테스트: `{소스파일명}.test.ts(x)`
- E2E 테스트: `{페이지명}.spec.ts`

```
components/counter.tsx     → __tests__/counter.test.tsx
app/page.tsx              → e2e/home.spec.ts
```

### Jest (단위 테스트)

```typescript
import { render, screen } from '@testing-library/react';
import { Counter } from '../components/counter';

describe('Counter', () => {
  it('should render initial count', () => {
    render(<Counter />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  describe('when clicked', () => {
    it('should increment count', async () => {
      // ...
    });
  });
});
```

### Playwright (E2E)

```typescript
import { expect, test } from '@playwright/test';

test.describe('Home Page', () => {
  test('should display intro section', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading')).toBeVisible();
  });
});
```

### 무엇을 검증할지

- 새 기능: 핵심 성공 경로 + 대표 실패 경로
- 버그 수정: 재현 케이스를 우선 테스트로 고정
- 리팩토링: 기존 동작이 유지되는지 회귀 방지
- 접근성/내비게이션 변경: keyboard, role, landmark, heading 흐름 우선

### Selector 원칙

- Playwright와 RTL 모두 **접근성 기반 selector**를 우선한다.
- 권장 순서:
  1. `getByRole`
  2. `getByLabelText` / `getByPlaceholderText`
  3. `getByText`
  4. 필요한 경우에만 `data-testid`
- 피해야 할 패턴: `nth-child`, 과도하게 긴 CSS selector, 스타일/구조에 강하게 결합된 selector, 번역 문구가 자주 바뀌는 영역을 텍스트로만 고정하는 방식.

### Flaky 방지

- 임의의 `waitForTimeout` 사용을 피한다.
- 비동기 UI는 상태 변화나 접근 가능한 요소의 등장으로 기다린다.
- E2E는 기존 로컬 dev 서버에 붙이기보다, 저장소에 정의된 `webServer` 흐름을 신뢰한다.
- Next 앱은 `.next` 상태, 포트 점유, 기존 서버 재사용이 원인이 될 수 있으므로 환경 문제를 먼저 의심한다.

### 이 저장소의 E2E 관점

- `apps/blog`, `apps/mumak-next`, `apps/mumak-react`가 Playwright E2E 대상.
- E2E는 빌드 결과 기반 서버 실행을 전제로 한다.
- `playwright.config.*`, `e2e/**`, 라우팅, 레이아웃, 메타데이터, UI 상호작용 변경 시 E2E 필요성을 적극 검토한다.
- `apps/blog`는 standalone 기반 경로를 사용하므로, 로컬 실패 시 `apps/blog/.next` 상태도 확인한다.

### 테스트 파일 내 Import 경로

```typescript
// 테스트 대상은 상대경로 OK
import { Counter } from '../components/counter';

// 유틸리티는 절대경로
import { mockUser } from '@/test/mocks';
```

### 완료 전 체크리스트

- [ ] 이번 변경이 막아야 하는 회귀를 테스트가 실제로 잡는가?
- [ ] 테스트를 직접 실행했는가?
- [ ] flaky 가능성이 높은 selector/wait 패턴을 피했는가?
- [ ] UI/라우팅 변경이면 E2E 필요성을 검토했는가?

---

## Turborepo / CI

- 앱 단위 preflight는 `check-types → lint → format:check → test:ci` 순서를 유지한다.
- Root Task 기반 Oxc 구조에서는 CI가 workspace-level `quality(lint + format:check)`를 먼저 실행하고, 이후 앱별 `check-types → test:ci → build`를 이어서 실행한다.
- Turborepo env는 가능한 한 태스크 범위로 제한하고, `globalEnv`는 최소 집합만 유지한다.
- `apps/blog` E2E는 `output: standalone` 기준으로 실행한다. CI에서는 standalone 산출물이 없을 때 fail-fast 처리한다.
- E2E workflow는 `test:e2e` 태스크의 `dependsOn: ["build"]`를 신뢰하고, 별도 중복 빌드 step은 지양한다.

---

## Editor / Tooling

- 에디터에서는 `ESLint`/`Prettier` 대신 `oxc.oxc-vscode`를 기본 formatter와 lint fixer로 사용한다.
- 워크스페이스 설정은 저장 시 Oxc 포맷, Oxc fix, import 정리 흐름을 유지한다.
- 코드 품질 검증은 계속 `pnpm lint`, `pnpm format:check`, `pnpm quality` 기준을 따른다.

---

## 추천 작업 흐름

### 코드 변경 후

1. 관련 규칙(이 파일 + nested `AGENTS.md`)을 따르며 구현
2. 필요하면 스킬 사용
   - 리팩토링: `expressive-refactor`
   - 검증: `ci-preflight`
3. 완료 후 `verifier` 서브에이전트로 실제 검증 범위 점검

### 테스트 실패 / 버그 발생 시

1. `debugger` 서브에이전트로 근본 원인 분석
2. 수정 후 `ci-preflight`
3. 마지막으로 `verifier`

### 리팩토링 시

1. 이름 개선
2. 함수/파일 분리
3. 필요한 경우에만 IIFE/체이닝
4. 테스트와 검증으로 회귀 확인

---

## 유지보수 원칙

- 에이전트가 같은 실수를 반복하면 이 파일 또는 스킬로 올린다.
- 특정 작업을 자꾸 채팅으로 길게 설명하게 되면 스킬 후보다.
- 검증 누락이 반복되면 `verifier` 또는 `ci-preflight`를 보강한다.
- 훅(`.cursor/hooks/`)은 안내형 스크립트로 유지하고, 복잡한 정책 엔진으로 키우지 않는다.
- MCP 서버는 실제로 자주 쓰는 최소 집합만 유지한다.

---

## 기타

- `gh` CLI 사용 가능.
- 이모지는 사용하지 않는다.

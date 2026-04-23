## Agent Navigation

이 저장소의 AI 에이전트는 상황에 맞는 지시를 다음 위치에서 참조한다.

| 위치                                         | 역할                                                      |
| -------------------------------------------- | --------------------------------------------------------- |
| `.cursor/rules/*.mdc`                        | Cursor 전용 자동 적용 규칙 (`alwaysApply` / `globs` 기반) |
| `.cursor/agents/*.md`                        | 프로젝트 특화 서브에이전트 (`debugger`, `verifier`)       |
| `.agents/skills/*/SKILL.md`                  | 프로젝트 공유 스킬 (Cursor · Claude Code 모두 로드)       |
| `.cursor/hooks.json`, `.cursor/hooks/*.mjs`  | edit-reminder, shell-guard 훅                             |
| `.cursor/mcp.json`                           | 프로젝트용 MCP 서버 설정                                  |
| `~/.ai-skills/skills`, `~/.ai-skills/agents` | 개발자 개인 user-level 자산 (전 프로젝트 공통)            |

자주 쓰이는 스킬:

- `ci-preflight` — `check-types → lint → format:check → test:ci` 로컬 검증 순서
- `turborepo` — Turborepo 필터 문법, 캐시 관리
- `shadcn` — shadcn/ui 컴포넌트 설치·커스터마이즈
- `react-component-generator` — 새 컴포넌트 스캐폴딩
- `test-writer` — Jest·Vitest·Playwright 테스트 작성
- `release` — Git Flow 기반 버전 관리

동일 이름의 스킬이 user와 project 양쪽에 있을 때는 **project 버전이 우선** 적용된다.

## 프로젝트 구조

Turborepo 모노레포. 공유 패키지는 `packages/`에, 앱은 `apps/`에 위치.

| 패키지                     | 용도                         |
| -------------------------- | ---------------------------- |
| `@mumak/ui`                | shadcn/ui 기반 공유 컴포넌트 |
| `@mumak/typescript-config` | TypeScript 설정              |

| 앱                 | 설명                    |
| ------------------ | ----------------------- |
| `apps/mumak-next`  | Next.js 15 (App Router) |
| `apps/mumak-react` | React + Vite            |
| `apps/blog`        | 블로그                  |

## Git Flow

- `main`: 프로덕션, `develop`: 개발 통합
- `feature/*`: develop에서 분기 → develop으로 머지
- `hotfix/*`: main에서 분기 → main, develop 둘 다 머지

## 네이밍 컨벤션

- 폴더명: **kebab-case** (`post-card`, `switch-theme`)
- 파일명: **kebab-case** (`counter.tsx`, `theme-provider.tsx`)
- 테스트 파일: `*.test.ts(x)`, E2E는 `*.spec.ts`
- 설정 파일: kebab-case (`jest.config.mjs`, `vite.config.ts`)

## TypeScript

- Prefer clear function/variable names over inline comments
- Use `knip` to remove unused code if making large changes
- Don't cast to `any`

## React

- Avoid massive JSX blocks and compose smaller components
- Colocate code that changes together
- Avoid `useEffect` unless absolutely needed

## Next.js

- Prefer fetching data in RSC
- Be mindful of serialized prop size for RSC → client components
- Use `priority` on next/image sparingly (LCP only)

## Turborepo / CI

- 앱 단위 preflight는 `check-types → lint → format:check → test:ci` 순서를 유지
- Root Task 기반 Oxc 구조를 사용할 때 CI는 workspace-level `quality(lint + format:check)`를 먼저 실행하고, 이후 앱별 `check-types → test:ci → build`를 이어서 실행
- Turborepo env는 가능한 태스크 범위로 제한하고, `globalEnv`는 최소 집합만 유지
- `apps/blog` E2E는 `output: standalone` 기준으로 실행하며, CI에서는 standalone 산출물 없을 때 fail-fast 처리
- E2E workflow는 `test:e2e` 태스크의 `dependsOn: ["build"]`를 신뢰하고, 별도 중복 빌드 step은 지양

## Editor / Tooling

- 에디터에서는 `ESLint`/`Prettier` 대신 `oxc.oxc-vscode`를 기본 formatter와 lint fixer로 사용
- 워크스페이스 설정은 저장 시 Oxc 포맷, Oxc fix, import 정리 흐름을 유지
- 코드 품질 검증은 계속 `pnpm lint`, `pnpm format:check`, `pnpm quality` 기준을 따름

## Tailwind

- Always use v4 + shadcn/ui
- Mostly use built-in values, rarely globals

## 기타

- `gh` CLI 사용 가능
- Don't use emojis

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

## Tailwind

- Always use v4 + shadcn/ui
- Mostly use built-in values, rarely globals

## 기타

- `gh` CLI 사용 가능
- Don't use emojis

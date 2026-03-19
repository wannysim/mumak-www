## 프로젝트 구조

Turborepo 모노레포. 공유 패키지는 `packages/`에, 앱은 `apps/`에 위치.

| 패키지                     | 용도                         |
| -------------------------- | ---------------------------- |
| `@mumak/ui`                | shadcn/ui 기반 공유 컴포넌트 |
| `@mumak/eslint-config`     | ESLint 설정                  |
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

- `check-types`는 각 앱의 `build` 결과에 의존할 수 있으므로, preflight에서는 `check-types → lint → format:check → test:ci` 순서를 유지
- Turborepo env는 가능한 태스크 범위로 제한하고, `globalEnv`는 최소 집합만 유지
- `apps/blog` E2E는 `output: standalone` 기준으로 실행하며, CI에서는 standalone 산출물 없을 때 fail-fast 처리
- E2E workflow는 `test:e2e` 태스크의 `dependsOn: ["build"]`를 신뢰하고, 별도 중복 빌드 step은 지양

## Tailwind

- Always use v4 + shadcn/ui
- Mostly use built-in values, rarely globals

## 기타

- `gh` CLI 사용 가능
- Don't use emojis

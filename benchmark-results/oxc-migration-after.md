# Oxc Migration Benchmark (After)

- Date: 2026-03-11
- Branch: `develop`
- Toolchain:
  - Lint: `oxlint` (`pnpm lint`)
  - Format: `oxfmt` (`pnpm format:check`, `pnpm format:fix`)

## Lint Benchmark (Oxlint)

### `pnpm lint` (root script)

- cold (3): `0.504`, `0.448`, `0.450` sec
- warm (5): `0.447`, `0.445`, `0.450`, `0.455`, `0.467` sec
- average:
  - cold: `0.467` sec
  - warm: `0.453` sec

### `pnpm turbo run lint` (root task orchestration)

- cold (1): `1.322` sec
- warm (2): `0.491`, `0.459` sec
- average:
  - cold: `1.322` sec
  - warm: `0.475` sec

## Format Benchmark (Oxfmt)

### `pnpm format:check` (stable, formatted tree)

- cold (3): `0.978`, `0.980`, `0.948` sec
- warm (5): `0.958`, `1.081`, `0.960`, `1.033`, `0.965` sec
- average:
  - cold: `0.969` sec
  - warm: `0.999` sec

### `pnpm format:fix` churn sample

- one run: `1.178` sec
- newly changed files from this run: `12`
- sample:
  - `.agents/skills/perf-optimization/SKILL.md`
  - `.agents/skills/react-component-generator/SKILL.md`
  - `.agents/skills/test-writer/SKILL.md`
  - `.agents/skills/turborepo/SKILL.md`
  - `.cursor/agents/debugger.md`
  - `.cursor/agents/verifier.md`
  - `.cursor/hooks/guard-shell.mjs`
  - `apps/blog/content/en/articles/css-animation-performance.mdx`
  - `apps/blog/content/en/garden/projects/digital-garden-and-pkm.mdx`
  - `apps/blog/content/ko/articles/css-animation-performance.mdx`
  - `apps/blog/content/ko/garden/projects/digital-garden-and-pkm.mdx`
  - `packages/ui/postcss.config.mjs`

## Before vs After (Key Points)

- lint root warm avg:
  - before (ESLint via Turbo): `0.555` sec
  - after (Oxlint root script): `0.453` sec
- lint cold avg:
  - before: `3.632` sec
  - after: `0.467` sec
- format check behavior:
  - before root Prettier check: baseline drift caused immediate fail
  - after Oxfmt + normalize: `format:check` passes consistently around `~1.0` sec

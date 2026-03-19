# Oxc Migration Baseline (Before)

- Date: 2026-03-11
- Branch: `develop`
- Node: `v24.11.1`
- pnpm: `10.30.3`

## Method

- Root benchmarks:
  - cold: 3 runs
  - warm: 5 runs
- Per-app benchmarks:
  - cold: 1 run
  - warm: 2 runs
- Cold lint runs used `--force` to avoid Turbo cache hits.
- Format check runs used current Prettier-based scripts.

## Raw Results

| Case                       |                  Cold (s) |                                    Warm (s) | Notes                              |
| -------------------------- | ------------------------: | ------------------------------------------: | ---------------------------------- |
| `root_lint`                | `5.290`, `2.755`, `2.850` | `0.572`, `0.549`, `0.551`, `0.554`, `0.548` | all pass                           |
| `root_format_check`        |                   `2.123` |                                           - | failed (existing formatting drift) |
| `blog_lint`                |                   `2.457` |                            `0.499`, `0.441` | all pass                           |
| `mumak_next_lint`          |                   `1.700` |                            `0.481`, `0.445` | all pass                           |
| `mumak_react_lint`         |                   `1.719` |                            `0.477`, `0.447` | all pass                           |
| `ui_lint`                  |                   `1.832` |                            `0.485`, `0.447` | all pass                           |
| `blog_format_check`        |                   `1.931` |                            `0.480`, `0.445` | all pass                           |
| `mumak_next_format_check`  |                   `1.665` |                            `0.479`, `0.444` | all pass                           |
| `mumak_react_format_check` |                   `1.193` |                            `0.473`, `0.449` | all pass                           |
| `ui_format_check`          |                   `2.215` |                            `0.465`, `0.450` | all pass                           |

## Summary (Average)

| Case                       | Cold Avg (s) | Warm Avg (s) |
| -------------------------- | -----------: | -----------: |
| `root_lint`                |      `3.632` |      `0.555` |
| `blog_lint`                |      `2.457` |      `0.470` |
| `mumak_next_lint`          |      `1.700` |      `0.463` |
| `mumak_react_lint`         |      `1.719` |      `0.462` |
| `ui_lint`                  |      `1.832` |      `0.466` |
| `blog_format_check`        |      `1.931` |      `0.463` |
| `mumak_next_format_check`  |      `1.665` |      `0.462` |
| `mumak_react_format_check` |      `1.193` |      `0.461` |
| `ui_format_check`          |      `2.215` |      `0.458` |

## Root Format Failure (Current State)

`pnpm format:check` failed before migration due to existing Prettier mismatches in workspace-level docs/config files, including:

- `.agents/skills/*`
- `.cursor/agents/*`
- `AGENTS.md`
- `README.md`
- `turbo.json`
- `apps/blog/content/.obsidian/*`

This is baseline state drift, not introduced by migration work.

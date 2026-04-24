# Cursor Setup

이 디렉터리는 **Cursor 전용** 설정만 담는다. 공통 규칙·스킬·서브에이전트는 이 폴더 바깥에 단일 소스로 관리된다.

- 공통 규칙: 루트 [`AGENTS.md`](../AGENTS.md) + `apps/*/AGENTS.md`, `packages/*/AGENTS.md` (nested)
- 스킬·서브에이전트 실체: [`.ai/skills/`](../.ai/skills), [`.ai/agents/`](../.ai/agents)
- Claude Code 진입점: 루트 [`CLAUDE.md`](../CLAUDE.md) (`@AGENTS.md` 어댑터)

Cursor는 이 중 다음을 자동으로 읽는다.

- `AGENTS.md` (nested 포함) — 공통 규칙
- `.cursor/skills` → `../.ai/skills` (symlink)
- `.cursor/agents` → `../.ai/agents` (symlink)
- `.cursor/hooks.json`, `.cursor/hooks/*.mjs`
- `.cursor/mcp.json`

---

## 왜 이런 구조인가

하나의 규칙을 두 곳(`.cursor/rules/` + `AGENTS.md`)에 중복해서 두면 반드시 드리프트가 생긴다. 그래서 저장소는 **AI provider에 중립적인 표준(`AGENTS.md`)을 단일 소스로 삼고**, Cursor 전용 기능만 이 디렉터리에 남긴다.

| 자산           | 위치                        | 비고                                                          |
| -------------- | --------------------------- | ------------------------------------------------------------- |
| 공통 규칙      | `AGENTS.md` (루트 + nested) | Cursor · Codex · Claude Code · Aider · Zed 등이 동일하게 읽음 |
| 스킬           | `.ai/skills/*/SKILL.md`     | Cursor 2.4+ / Claude Code / Codex 공통 포맷                   |
| 서브에이전트   | `.ai/agents/*.md`           | Cursor · Claude Code 공통 포맷                                |
| Cursor 전용 훅 | `.cursor/hooks*`            | 다른 provider에 대응 표준 없음                                |
| Cursor MCP     | `.cursor/mcp.json`          | Claude Code는 별도 `.mcp.json` 사용                           |

`.cursor/rules/`는 의도적으로 두지 않는다. 과거에 존재하던 `.mdc` 파일들은 모두 `AGENTS.md`(루트 또는 nested)로 이전되었다.

---

## 구성 요소

### Skills (symlink)

- 위치: `.cursor/skills` → `../.ai/skills`
- 실체는 `.ai/skills/*/SKILL.md`
- 수정할 때는 **항상 `.ai/skills/` 쪽을 편집**한다. symlink를 통해 편집해도 결과는 같지만, 멘탈 모델을 실체 쪽으로 유지하는 편이 혼란이 적다.

대표 스킬:

- `ci-preflight` — `check-types → lint → format:check → test:ci`
- `turborepo` — 필터 문법, 캐시 관리
- `shadcn` — 컴포넌트 설치·커스터마이즈
- `react-component-generator` — 새 컴포넌트 스캐폴딩
- `test-writer` — Jest · Vitest · Playwright 테스트 작성
- `release` — Git Flow 기반 버전 관리
- `expressive-refactor` — 이름·구조 중심 리팩토링
- `perf-optimization` — 성능 체크리스트

### Agents (symlink)

- 위치: `.cursor/agents` → `../.ai/agents`
- 실체는 `.ai/agents/*.md`

제공 서브에이전트:

- `verifier` — 완료 주장과 실제 검증 사이의 누락을 찾는다
- `debugger` — 에러·테스트 실패의 근본 원인을 분석한다

권장 사용 시점:

- 구현 완료 후 실제로 다 검증했는지 확인하고 싶을 때: `verifier`
- 실패 로그가 길고 원인이 불명확할 때: `debugger`

### Hooks

- `.cursor/hooks.json`
- `.cursor/hooks/guard-shell.mjs`
- `.cursor/hooks/edit-reminder.mjs`

역할:

- 위험한 명령 전에 한 번 더 확인
- 파일 수정 후 검증 습관 상기

현재 동작:

- `beforeShellExecution` — `git push`, `rm -rf`, DB 상태 변경 명령, SQL write 계열 명령에 대해 `ask` 중심 확인
- `postToolUse` — 파일 수정 후 `ci-preflight` 또는 `verifier` 사용 상기

강한 차단이 아닌 **안내 중심**으로 설계되어 있다. 복잡한 정책 엔진으로 키우지 않는다.

### MCP

- `.cursor/mcp.json`

현재 포함:

- `context7` — 최신 문서·레퍼런스 탐색
- `playwright` — 브라우저·테스트 자동화 보조

설계 원칙:

- Jira·Figma처럼 인증과 팀 정책이 강하게 걸리는 연결은 기본 포함하지 않는다
- read-mostly 또는 테스트 중심의 최소 구성만 제공한다

---

## 추천 작업 흐름

### 코드 변경 후

1. 관련 규칙(`AGENTS.md` + nested `AGENTS.md`)을 따르며 구현
2. 필요하면 스킬 사용
   - 리팩토링: `expressive-refactor`
   - 검증: `ci-preflight`
3. 완료 후 `verifier`로 실제 검증 범위 점검

### 테스트 실패 / 버그 발생 시

1. `debugger`로 근본 원인 분석
2. 수정 후 `ci-preflight`
3. 마지막으로 `verifier`

### 리팩토링 시

1. 이름 개선
2. 함수·파일 분리
3. 필요한 경우에만 IIFE·체이닝
4. 테스트와 검증으로 회귀 확인

---

## 팀 공유 관점

이 설정은 개인 생산성뿐 아니라, 팀원이 같은 저장소에서 비슷한 방식으로 Cursor를 사용하도록 돕는 목적도 있다. 특히 아래가 중요하다.

- **공통 규칙은 `AGENTS.md`에만** — 여기에 복제하지 않는다
- 저장소 특화 워크플로우는 스킬로 남긴다
- 강한 차단보다 설명 가능한 가드레일을 우선한다

## 유지보수 원칙

- 에이전트가 같은 실수를 반복하면 `AGENTS.md` 또는 스킬로 올린다
- 특정 작업을 자꾸 채팅으로 길게 설명하게 되면 스킬 후보다
- 검증 누락이 반복되면 `verifier` 또는 `ci-preflight`를 보강한다
- 훅은 작은 안내형 스크립트로 유지한다
- MCP는 실제로 자주 쓰는 최소 서버만 유지한다

## 새 PC 초기 세팅

user-level 자산(`~/.ai-skills`)은 별도 저장소에서 관리한다. 새 PC에서 처음 세팅할 때:

```bash
git clone git@github.com:wannysim/ai-skills.git ~/.ai-skills
cd ~/.ai-skills
./bootstrap.sh
```

이 저장소의 project-level 자산(`.ai/`, `AGENTS.md`, `.cursor/`, `.claude/`)은 리포지토리 clone만으로 바로 동작한다. 별도 부트스트랩이 필요 없다.

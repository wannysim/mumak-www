@AGENTS.md

## Claude Code 전용 메모

이 파일은 루트 `AGENTS.md`를 import하는 얇은 어댑터다.
모든 공통 규칙·컨벤션은 `AGENTS.md`에 있고, Claude Code 전용 보완 사항만 여기에 추가한다.

- 스킬 실체: `.ai/skills/*/SKILL.md` (`.claude/skills`는 symlink)
- 서브에이전트 실체: `.ai/agents/*.md` (`.claude/agents`는 symlink)
- 수정은 항상 `.ai/` 쪽에서 한다. `.claude/` 하위를 직접 편집하지 말 것.

### 권장 사용 패턴

- 실패 로그가 길거나 원인이 불명확할 때: `debugger` 서브에이전트 위임
- 구현 완료 후 실제 검증 범위 점검: `verifier` 서브에이전트 위임
- 로컬 검증 순서가 필요할 때: `ci-preflight` 스킬 사용

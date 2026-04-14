# Cursor Setup

이 저장소의 AI 작업 설정은 `.cursor`와 `.agents` 폴더에 나뉘어 있습니다.

- `.cursor/`는 Cursor 프로젝트 설정에 가까운 자산
- `.agents/`는 다른 에이전트 환경과도 공유 가능한 범용 자산

즉, Cursor를 단순한 채팅 도구가 아니라, **저장소 특화 작업 환경**으로 만들기 위한 설정 모음입니다.

목표는 세 가지입니다.

- 더 일관되게 검증하기
- 더 읽히는 방향으로 리팩토링하기
- 위험한 작업 전에 한 번 더 생각하게 만들기

강한 차단보다 **권장과 안내 중심**으로 설계되어 있습니다.

## 구성 요소

### Rules

위치: `.cursor/rules/`

역할:

- 프로젝트 컨벤션을 Agent에게 지속적으로 주입
- import, 컴포넌트 패턴, 테스트 방식, 블로그/가든 작성 규칙 등을 일관되게 유지

대표 파일:

- `import-patterns.mdc`
- `component-patterns.mdc`
- `testing.mdc`
- `blog-fsd.mdc`
- `digital-garden.mdc`

Rules는 "항상 지켜야 하는 기준"에 가깝습니다.

### Skills

위치: `.agents/skills/`

역할:

- 특정 작업을 수행하는 절차를 Agent에게 가르침
- 단순한 문체 지시가 아니라, 실행 순서와 참고 문서를 포함한 워크플로우 제공
- Cursor 전용 자산이라기보다, 가능한 한 다른 에이전트 환경에서도 재사용 가능한 형태로 유지

대표 파일:

- `ci-preflight/SKILL.md`
- `expressive-refactor/SKILL.md`
- `test-writer/SKILL.md`
- `turborepo/SKILL.md`
- `perf-optimization/SKILL.md`

Skills는 "특정 작업을 어떻게 수행할 것인가"에 가깝습니다.
그래서 이 저장소에서는 `.cursor/skills/` 대신 `.agents/skills/`에 두어 범용성을 높입니다.

### Agents

위치: `.cursor/agents/`

역할:

- 메인 에이전트가 필요할 때 위임할 보조 작업자 정의
- 컨텍스트 분리를 통해 검증/디버깅 품질 향상

현재 제공:

- `verifier.md`
  - 완료 주장과 실제 검증 사이의 누락을 찾는 검증자
- `debugger.md`
  - 에러와 테스트 실패의 근본 원인을 분석하는 디버거

권장 사용 시점:

- 구현 완료 후 실제로 다 검증했는지 확인하고 싶을 때: `verifier`
- 실패 로그가 길고 원인이 불명확할 때: `debugger`

### Hooks

파일:

- `.cursor/hooks.json`
- `.cursor/hooks/guard-shell.mjs`
- `.cursor/hooks/edit-reminder.mjs`

역할:

- 위험한 명령 전에 한 번 더 확인
- 파일 수정 후 검증 습관을 상기

현재 동작:

- `beforeShellExecution`
  - `git push`, `rm -rf`, DB 상태를 바꿀 수 있는 명령, SQL write 계열 명령에 대해 `ask` 중심 확인
- `postToolUse`
  - 파일 수정 후 `ci-preflight` 또는 `verifier` 사용을 상기

주의:

- 강한 차단은 기본적으로 하지 않습니다.
- 이 훅들은 저장소 작업 흐름을 완전히 막기보다, **실수 방지와 검증 습관 강화**를 목표로 합니다.

### MCP

파일:

- `.cursor/mcp.json`

현재 포함:

- `context7`
  - 최신 문서/레퍼런스 탐색용
- `playwright`
  - 브라우저/테스트 자동화 보조용

설계 원칙:

- Jira/Figma처럼 인증과 팀 정책이 강하게 걸리는 연결은 기본 포함하지 않음
- 우선은 read-mostly 또는 테스트 중심의 최소 구성만 제공

## 추천 작업 흐름

### 코드 변경 후

1. 관련 Rule을 따르며 구현
2. 필요하면 Skill 사용
   - 리팩토링: `expressive-refactor`
   - 검증: `ci-preflight`
3. 완료 후 `verifier`로 실제 검증 범위 점검

### 테스트 실패/버그 발생 시

1. `debugger`로 근본 원인 분석
2. 수정 후 `ci-preflight`
3. 마지막으로 `verifier`

### 리팩토링 시

1. 이름 개선
2. 함수/파일 분리
3. 필요한 경우에만 IIFE/체이닝
4. 테스트와 검증으로 회귀 확인

## 팀 공유 관점

이 `.cursor` 설정은 개인 생산성뿐 아니라, 팀원이 같은 저장소에서 비슷한 방식으로 Cursor를 사용하도록 돕는 목적도 있습니다.

특히 아래가 중요합니다.

- Rule/Skill/Agent의 역할을 섞지 않기
- 저장소 특화 워크플로우를 문서로 남기기
- 강한 차단보다 설명 가능한 가드레일을 우선하기

## 유지보수 원칙

- Agent가 같은 실수를 반복하면 Rule 또는 Skill로 올립니다.
- 특정 작업을 자꾸 채팅으로 길게 설명하게 되면 Skill 후보입니다.
- 검증 누락이 반복되면 `verifier` 또는 `ci-preflight`를 보강합니다.
- 훅은 작은 안내형 스크립트로 유지하고, 복잡한 정책 엔진으로 키우지 않습니다.
- MCP는 실제로 자주 쓰는 최소 서버만 유지합니다.

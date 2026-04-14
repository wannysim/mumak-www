---
name: ci-preflight
description: 코드 작성 완료 후 CI 검증을 로컬에서 수행합니다. 코드 변경 완료 시, 커밋 요청 시, PR 생성 요청 시 자동으로 적용됩니다.
---

# CI Preflight 검증

코드 변경 후 커밋/PR 전에 CI에서 실행되는 검증을 로컬에서 먼저 수행합니다.

이 스킬의 역할은 **검증 절차를 실행하는 것**입니다.
완료 주장과 실제 검증 범위 사이의 누락을 판단하는 역할은 `verifier` 서브에이전트가 맡습니다.

## 필수: 코드 변경 완료 시 검증

코드 작성을 완료하면 **반드시** 아래 검증을 순서대로 실행합니다.

### 1. 변경된 앱 확인

```bash
# 현재 브랜치에서 변경된 파일 확인
git diff --name-only origin/develop...HEAD

# 변경된 앱 파악 (apps/ 또는 packages/ 하위)
```

### 2. 검증 실행 (순서 중요)

```bash
# 1) Type Check - 가장 먼저 (타입 오류가 다른 검증에 영향)
pnpm turbo run check-types --filter=<app>

# 2) Lint
pnpm turbo run lint --filter=<app>

# 3) Format Check
pnpm turbo run format:check --filter=<app>

# 4) Test
pnpm turbo run test:ci --filter=<app>

# 5) Build (선택적 - PR 전 권장)
pnpm turbo run build --filter=<app>

# 6) E2E (선택적 - E2E workflow 대상 앱은 PR 전 권장)
pnpm turbo run test:e2e --filter=<app>
```

> 참고: `apps/blog`는 `output: standalone` 기반 E2E를 사용하므로, CI 모드에서는 build 산출물(`.next/standalone/...`)이 없으면 테스트가 시작되지 않도록 fail-fast 됩니다.

## 언제 build / E2E까지 올릴 것인가

아래에 해당하면 `build`와 `test:e2e`까지 적극적으로 실행합니다.

- `app/`, `src/`, `components/`, `widgets/`, `features/` 변경
- 라우팅, 레이아웃, 메타데이터, `playwright.config.*`, `e2e/**` 변경
- `apps/blog`, `apps/mumak-next`, `apps/mumak-react`의 UI 동작 변경
- 리팩토링이지만 동작 보존이 중요한 변경

반대로 문서, 주석, 순수 설정 변경처럼 런타임 영향이 거의 없으면 `check-types -> lint -> format:check -> test:ci`까지만 우선 수행할 수 있습니다.

### 3. 빠른 전체 검증

변경된 부분만 한번에 검증:

```bash
# develop 브랜치 대비 변경된 부분 검증
# 주의: zsh에서는 반드시 따옴표로 감싸야 함 (bracket이 glob으로 해석됨)
pnpm turbo run check-types lint format:check test:ci --filter='[origin/develop...HEAD]'
```

## Turbo 필터 팁

### 자주 사용하는 패턴

```bash
# 특정 앱만
--filter=blog
--filter=mumak-next

# 변경된 부분만 (CI와 동일)
# zsh에서는 따옴표 필수
--filter='[origin/develop...HEAD]'

# 특정 앱 + 의존성
--filter=...blog
```

### 캐시 관련

```bash
# 캐시 무시 (이상한 동작 시)
pnpm turbo run check-types --force

# 전체 캐시 삭제
pnpm turbo:clean && pnpm install
```

### E2E가 로컬에서 이상할 때

```bash
# blog 등 Next 앱의 로컬 상태가 꼬였을 때
rm -rf apps/blog/.next

# 기존 서버 재사용/포트 충돌 의심 시
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:3001 -sTCP:LISTEN
lsof -nP -iTCP:3002 -sTCP:LISTEN
```

특히 `apps/blog`는 과거에 `.next` 상태나 기존 서버 재사용 때문에 로컬 E2E가 흔들린 적이 있으므로, 캐시보다 **로컬 산출물/서버 상태**를 먼저 의심합니다.

## 자주 발생하는 오류와 해결

### Type Check 실패

| 오류 유형            | 원인             | 해결                                                |
| -------------------- | ---------------- | --------------------------------------------------- |
| `Cannot find module` | 빌드 순서 문제   | `pnpm turbo run build --filter=@mumak/ui` 먼저 실행 |
| 타입 불일치          | 의존 패키지 변경 | 해당 패키지 `check-types` 먼저 확인                 |
| `.d.ts` 없음         | 빌드 미실행      | 의존 패키지 빌드 후 재시도                          |

### Lint 실패

```bash
# 자동 수정 가능한 것들
pnpm turbo run lint:fix --filter=<app>
```

### Format 실패

```bash
# 포맷 자동 적용
pnpm turbo run format --filter=<app>
```

## 검증 체크리스트

코드 변경 완료 시 확인:

- [ ] `check-types` 통과
- [ ] `lint` 통과 (또는 `lint:fix` 실행)
- [ ] `format:check` 통과 (또는 `format` 실행)
- [ ] `test:ci` 통과
- [ ] (PR 전) `build` 통과
- [ ] (E2E 대상 앱) `test:e2e` 통과

## 빠른 검증 스크립트

전체 검증을 한번에 실행하려면:

```bash
./scripts/preflight.sh [app-name] [--with-build] [--with-e2e]
```

예시:

```bash
# 변경된 부분만 기본 검증
./scripts/preflight.sh

# blog만 build 포함 검증
./scripts/preflight.sh blog --with-build

# blog만 build + e2e 포함 검증
./scripts/preflight.sh blog --with-build --with-e2e
```

스크립트 없이 한줄로:

```bash
pnpm turbo run check-types lint format:check test:ci --filter='[origin/develop...HEAD]'
```

## 완료 보고 원칙

- 어떤 앱/패키지를 대상으로 검증했는지 명시합니다.
- 실행한 단계와 생략한 단계를 분리해서 보고합니다.
- 실패 시, 첫 번째 실패 단계와 재현 명령을 함께 적습니다.
- 필요하면 `verifier` 서브에이전트에게 후속 검증을 맡깁니다.

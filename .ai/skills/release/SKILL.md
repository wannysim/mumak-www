---
name: release
description: Git Flow를 사용한 릴리즈 및 버전 관리 가이드입니다. 릴리즈 요청 시, 버전 업 요청 시, hotfix 필요 시 사용합니다.
---

# Release 가이드

Git Flow와 버전 동기화 스크립트를 사용한 릴리즈 워크플로우입니다.

## Semantic Versioning

버전 형식: `MAJOR.MINOR.PATCH`

| 유형      | 언제 올림               | 예시          |
| --------- | ----------------------- | ------------- |
| **MAJOR** | 호환되지 않는 API 변경  | 1.0.0 → 2.0.0 |
| **MINOR** | 하위 호환되는 기능 추가 | 1.0.0 → 1.1.0 |
| **PATCH** | 하위 호환되는 버그 수정 | 1.0.0 → 1.0.1 |

### 프리릴리즈 버전

- `1.0.0-alpha.1` - 알파 (내부 테스트)
- `1.0.0-beta.1` - 베타 (외부 테스트)
- `1.0.0-rc.1` - 릴리즈 후보

## Release 워크플로우

이 저장소는 `main`, `develop` 보호 규칙과 GitHub의 `delete_branch_on_merge` 설정을 전제로 한다.

- `main` release PR은 **merge commit**으로 머지한다.
- `develop` back-sync PR은 태그가 붙은 `origin/main` 기준 브랜치를 만들어 **merge commit**으로 머지한다.
- `develop` ruleset은 release 태그 커밋의 ancestry 보존을 위해 PR merge method를 `merge`만 허용한다.
- `delete_branch_on_merge: true`라서 `release/<version>` PR이 `main`에 merge되면 원격 release 브랜치가 자동 삭제될 수 있다.
- 따라서 **release 브랜치를 develop back-sync의 head로 쓰지 않는다**. main merge와 태그 생성 후 `origin/main`에서 별도 sync 브랜치를 만든다.
- 보호 브랜치에 직접 push하거나 `git flow release finish`로 로컬에서 main/develop을 직접 머지하지 않는다.

### 1. 현재 버전 확인

```bash
git fetch origin --prune --tags
git switch develop
git merge --ff-only origin/develop
node scripts/sync-versions.mjs --check
```

### 2. Release 브랜치 생성

```bash
git flow release start <version>

# 예: 1.2.0 릴리즈
git flow release start 1.2.0
```

### 3. 버전 동기화

```bash
# 모든 package.json 버전 업데이트
node scripts/sync-versions.mjs <version>

# 예시
node scripts/sync-versions.mjs 1.2.0
```

### 4. 변경사항 커밋

```bash
git add -A
git commit -m "chore: update version"
```

### 5. 로컬 검증

```bash
node scripts/sync-versions.mjs --check
pnpm format:check
pnpm quality
pnpm turbo run test:ci --filter='[origin/develop...HEAD]'
```

변경 범위가 넓거나 CI와 동일하게 확인해야 하면 필요한 앱별 `check-types`, `test:e2e`, `build`도 추가한다.

### 6. release 브랜치 push 및 main PR 생성

```bash
git push -u origin release/<version>

gh pr create \
  --base main \
  --head release/<version> \
  --title "chore: release <version>"
```

main PR의 모든 CI, E2E, Codecov, Vercel 체크가 통과해야 한다. Codecov project가 release aggregate 비교 때문에 실패하면 threshold를 완화하지 말고, 가능한 경우 실제 테스트를 추가해 복구한다.

### 7. main PR merge 및 태그 생성

```bash
gh pr merge <main-release-pr-number> --merge

git fetch origin main --tags
git tag -a <version> origin/main -m "chore: release <version> <version>"
git push origin <version>
```

태그는 main의 merge commit에 붙인다. 기존 태그가 있으면 덮어쓰지 말고 원인을 먼저 확인한다.

### 8. develop back-sync PR 생성

main PR merge와 태그 push 후, 태그가 붙은 `origin/main` 커밋에서 sync 브랜치를 만든다. 이 브랜치를 develop에 merge commit으로 머지해야 release 태그 커밋이 develop의 조상으로 남는다.

```bash
git fetch origin --prune --tags
git switch -c chore/sync-release-<version> origin/main

node scripts/sync-versions.mjs --check
git push -u origin chore/sync-release-<version>

gh pr create \
  --base develop \
  --head chore/sync-release-<version> \
  --title "chore: sync release <version> to develop"
```

### 9. develop back-sync PR merge

```bash
gh pr checks <develop-sync-pr-number> --watch
gh pr merge <develop-sync-pr-number> --merge --delete-branch
```

develop sync PR도 required checks가 모두 통과한 뒤 merge한다. merge 후 `git merge-base --is-ancestor <version> origin/develop`가 성공해야 한다.

### 10. 로컬 정리 및 최종 확인

```bash
git fetch origin --prune --tags
git switch develop
git merge --ff-only origin/develop
git switch main
git merge --ff-only origin/main
git switch develop

node scripts/sync-versions.mjs --check
git tag --sort=-v:refname | head
git status --short --branch
```

## Hotfix 워크플로우

프로덕션 긴급 버그 수정 시 사용합니다.

### 1. Hotfix 브랜치 생성

```bash
git flow hotfix start <version>

# 예: 1.2.0에서 버그 발견 → 1.2.1
git flow hotfix start 1.2.1
```

### 2. 버그 수정 후 버전 동기화

```bash
# 수정 작업 완료 후
node scripts/sync-versions.mjs <version>
git add -A
git commit -m "chore: update version"
```

### 3. Hotfix 완료

```bash
# main PR과 develop back-sync PR을 release 워크플로우와 같은 방식으로 진행한다.
# hotfix/<version> 원격 브랜치도 main merge 후 자동 삭제될 수 있으므로
# main merge 전에 chore/sync-hotfix-<version> 브랜치를 미리 만든다.
```

## sync-versions.mjs 사용법

### 명령어

```bash
# 버전 동기화 상태 확인
node scripts/sync-versions.mjs --check

# root 버전으로 동기화
node scripts/sync-versions.mjs

# 특정 버전으로 동기화
node scripts/sync-versions.mjs 1.2.0
node scripts/sync-versions.mjs 2.0.0-beta.1
```

### 동작

- `package.json` (root)
- `apps/*/package.json` (모든 앱)

모든 package.json의 version 필드를 동일하게 맞춥니다.

## 체크리스트

### Release 전

- [ ] develop 브랜치 최신 상태
- [ ] 버전 동기화 확인 (`node scripts/sync-versions.mjs --check`)
- [ ] 버전 번호 결정 (semver 기준)
- [ ] release 브랜치 생성 및 version bump 커밋
- [ ] 로컬 검증 통과 (`sync-versions --check`, `format:check`, `quality`, 관련 `test:ci`)

### Release 후

- [ ] main release PR merge commit으로 merge 완료
- [ ] `1.x.x` 태그가 main merge commit을 가리킴
- [ ] develop back-sync PR merge commit으로 merge 완료
- [ ] `git merge-base --is-ancestor 1.x.x origin/develop` 성공
- [ ] 원격 임시 브랜치 정리 확인
- [ ] 로컬 main/develop fast-forward 완료
- [ ] 버전 동기화 확인 (`node scripts/sync-versions.mjs --check`)

## 문제 해결

| 문제                      | 해결                                                                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| git flow 미설치           | macOS: `brew install git-flow` / Linux: `sudo apt install git-flow`                                                                                       |
| 버전 불일치               | `node scripts/sync-versions.mjs`                                                                                                                          |
| 태그 충돌                 | `git tag -d <tag>` 후 재시도                                                                                                                              |
| release 브랜치 자동 삭제  | repo의 `delete_branch_on_merge`가 켜져 있으면 정상 동작. main merge 후 `origin/main`에서 `chore/sync-release-<version>` 브랜치를 만들어 develop sync 진행 |
| develop sync PR 생성 실패 | `git fetch origin --prune --tags` 후 `git switch -c chore/sync-release-<version> origin/main`으로 별도 브랜치 생성                                        |
| 머지 충돌                 | release 브랜치에서 해결 후 main PR을 갱신하고, sync 브랜치는 release-only 커밋 범위를 다시 cherry-pick                                                    |

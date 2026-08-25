---
name: release
description: 보호 브랜치와 원격 ref를 기준으로 릴리즈 및 버전을 관리합니다. 릴리즈 요청, 버전 업, hotfix 작업 시 사용합니다.
---

# Release 가이드

원격 보호 브랜치와 버전 동기화 스크립트를 기준으로 릴리즈하라.

## Release 워크플로우

이 저장소는 `main`, `develop` 보호 규칙과 GitHub의 `delete_branch_on_merge` 설정을 전제로 한다.

- `main` release PR은 **merge commit**으로 머지한다.
- `develop` back-sync PR은 태그가 붙은 `origin/main` 기준 브랜치를 만들어 **merge commit**으로 머지한다.
- `develop` ruleset은 일반 feature PR의 squash merge와 release back-sync PR의 merge commit을 모두 지원하기 위해 `squash`, `merge` 둘 다 허용한다.
- `delete_branch_on_merge: true`라서 `release/<version>` PR이 `main`에 merge되면 원격 release 브랜치가 자동 삭제될 수 있다.
- 따라서 **release 브랜치를 develop back-sync의 head로 쓰지 않는다**. main merge와 태그 생성 후 `origin/main`에서 별도 sync 브랜치를 만든다.
- 보호 브랜치에 직접 push하지 마라. 최신 원격 ref에서 작업 브랜치를 만들고 로컬 `main`이나 `develop` 상태에 의존하지 마라.

### 1. 작업 트리와 원격 확인

```bash
test -z "$(git status --porcelain)" || {
  echo "작업 트리를 먼저 정리하라." >&2
  exit 1
}
git fetch origin --prune --tags
```

fetch 후 원격 ref에서 버전 판정 근거를 수집하라.

```bash
root_version=$(git show origin/develop:package.json |
  node -p "JSON.parse(require('node:fs').readFileSync(0, 'utf8')).version")
stable_tag=$(git tag --merged origin/main --sort=-v:refname |
  awk '/^[0-9]+\.[0-9]+\.[0-9]+$/ { print; exit }')

test -n "$root_version" || {
  echo "origin/develop의 root package version을 읽지 못했다." >&2
  exit 1
}
test -n "$stable_tag" || {
  echo "origin/main에서 도달 가능한 stable tag가 없다." >&2
  exit 1
}
printf 'root package version: %s\nlatest stable tag: %s\n' "$root_version" "$stable_tag"
git log --oneline --decorate "${stable_tag}"..origin/develop
git diff --stat "${stable_tag}"..origin/develop
```

log와 diff stat을 출발점으로 관련 diff와 PR 본문을 확인해 호환성 영향을 판정하라. 여러 유형이 섞이면 가장 높은 단계를 적용하라.

| 판정  | 기준                                                                  | `1.16.0` 예시 |
| ----- | --------------------------------------------------------------------- | ------------- |
| MAJOR | 외부 API·저장 데이터·설정/배포 계약 등 공개 계약의 호환 불가능한 변경 | `2.0.0`       |
| MINOR | 공개 계약을 유지하는 하위 호환 사용자 기능 추가                       | `1.17.0`      |
| PATCH | 새 기능 없는 버그 수정·내부 리팩터링·의존성·운영 변경만               | `1.16.1`      |

`alpha`, `beta`, `rc`는 사용자가 명시적으로 요청했거나 사용자와 단계 테스트 계획을 명시적으로 합의했을 때만 선택하라. 에이전트가 필요성을 임의 판단하지 마라. 먼저 위 기준으로 base bump를 정한 뒤 `<base>-alpha.1`, `<base>-beta.1`, `<base>-rc.1` 형태를 사용하라.

root package version과 stable tag가 다르거나 공개 계약의 호환성 판단이 애매하면 자동 추정하지 마라. 확인한 version·tag·log·diff 근거와 추천 버전을 제시하고 사용자 확인을 받은 뒤에만 `node scripts/sync-versions.mjs <version>`을 실행하라.

### 2. Release 브랜치 생성

```bash
git switch -c release/<version> origin/develop
node scripts/sync-versions.mjs --check
```

### 3. 버전 동기화

```bash
# root package.json과 apps/*/package.json 버전 업데이트
node scripts/sync-versions.mjs <version>
```

### 4. 변경사항 커밋

```bash
git add -- package.json 'apps/*/package.json'
git diff --cached --name-only
git commit -m "chore: update version"
```

staged 목록에 root `package.json`과 `apps/*/package.json` 외 파일이 있으면 중단하라.

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

merge 전에 현재 branch ruleset의 required checks만 조회하고 통과시켜라.

```bash
gh pr checks <main-release-pr-number> --required --watch
```

Codecov와 Vercel을 자동으로 required로 간주하지 마라. live ruleset이 요구하면 따르고, 현재 workflow와 ruleset이 production 요구로 명시하지 않으면 Vercel을 dev/PR preview로만 취급하라. Production artifact promotion 경로는 `.github/workflows/promote.yml`로 판정하라.

### 7. main PR merge 및 태그 생성

```bash
gh pr merge <main-release-pr-number> --merge

release_sha=$(gh pr view <main-release-pr-number> --json mergeCommit --jq '.mergeCommit.oid')
git fetch origin --prune --tags
test "$(git rev-parse origin/main)" = "$release_sha" || {
  echo "origin/main이 PR merge commit과 다르다." >&2
  exit 1
}
git tag -a <version> "$release_sha" -m "chore: release <version>"
git push origin <version>
```

`origin/main`이 PR의 `mergeCommit.oid`와 다르면 중단하라. 태그는 검증한 `release_sha`에 붙이고 기존 태그를 덮어쓰지 마라.

### 8. Production artifact promotion 확인

main PR의 merge commit SHA를 기준으로 현재 `Promote to Production` workflow를 확인하라.

```bash
release_sha=$(gh pr view <main-release-pr-number> --json mergeCommit --jq '.mergeCommit.oid')

gh run list --workflow promote.yml --commit "$release_sha" \
  --json databaseId,headSha,status,conclusion,url
gh run view <promote-run-id> --json headSha,conclusion,jobs,url
```

`headSha`가 `release_sha`와 같고 `Push production images to GHCR`와 `Report successful promote (commit status)`가 성공한 run만 production artifact promotion 성공 근거로 삼아라. run 전체가 `success`여도 두 step이 skipped면 새 promotion으로 간주하지 마라.

이 workflow에는 Watchtower pull, container restart, health acknowledgement가 없으므로 실제 serving 성공을 주장하지 마라. 별도로 관측하지 않았다면 serving 상태를 `unverified`로 기록하라. Vercel preview도 production serving 근거로 사용하지 마라.

### 9. develop back-sync PR 생성

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

### 10. develop back-sync PR merge

```bash
gh pr checks <develop-sync-pr-number> --required --watch
gh pr merge <develop-sync-pr-number> --merge --delete-branch
git fetch origin develop --tags
git merge-base --is-ancestor <version> origin/develop
```

develop sync PR도 required checks가 모두 통과한 뒤 merge하라. fetch 후 태그 커밋이 `origin/develop`의 조상인지 확인하라.

### 11. 로컬 정리 및 최종 확인

```bash
git fetch origin --prune --tags
node scripts/sync-versions.mjs --check
git tag --sort=-v:refname | head
git status --short --branch
```

## Hotfix 워크플로우

프로덕션 긴급 버그 수정 시 사용합니다.

### 1. Hotfix 브랜치 생성

```bash
test -z "$(git status --porcelain)" || {
  echo "작업 트리를 먼저 정리하라." >&2
  exit 1
}
git fetch origin --prune --tags
git switch -c hotfix/<version> origin/main
```

### 2. 버그 수정 후 버전 동기화

```bash
# 버그 수정을 먼저 커밋하고 root package.json과 apps/*/package.json만 stage
node scripts/sync-versions.mjs <version>
git add -- package.json 'apps/*/package.json'
git diff --cached --name-only
git commit -m "chore: update version"
```

### 3. Hotfix 완료

main PR, merge, 명시적 SHA 태그, artifact promotion을 release 단계와 같은 방식으로 진행하라. main merge와 태그 push를 완료한 뒤에만 검증한 `origin/main`에서 sync 브랜치를 만들어라.

```bash
git fetch origin --prune --tags
git switch -c chore/sync-hotfix-<version> origin/main
```

이후 release의 back-sync 단계를 따르되 head를 `chore/sync-hotfix-<version>`으로 사용하라.

## 완료 조건

- [ ] main release/hotfix PR merge commit으로 merge 완료
- [ ] 태그가 검증한 `mergeCommit.oid`를 가리킴
- [ ] 같은 merge commit SHA의 production artifact promotion step 성공
- [ ] 실제 serving을 별도로 관측했거나 `unverified`로 기록
- [ ] develop back-sync PR merge commit으로 merge 완료
- [ ] 태그 커밋이 fetch한 `origin/develop`의 조상임
- [ ] 버전 동기화 확인 (`node scripts/sync-versions.mjs --check`)

## 문제 해결

| 문제      | 해결                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------ |
| 태그 충돌 | 중단하고 기존 태그가 가리키는 SHA와 PR의 `mergeCommit.oid`를 비교하라.                                             |
| 머지 충돌 | 충돌과 merge base를 조사하고, sync 브랜치가 검증한 `origin/main` merge commit을 조상으로 유지한 상태에서 해결하라. |

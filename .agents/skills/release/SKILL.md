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

### 1. 현재 버전 확인

```bash
node scripts/sync-versions.mjs --check
```

### 2. Release 브랜치 생성

```bash
# git flow 사용
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

### 5. Release 완료

```bash
# main과 develop에 머지, 태그 생성
git flow release finish <version>

# 푸시 (태그 포함)
git push origin main develop --tags
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
git flow hotfix finish <version>
git push origin main develop --tags
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
- [ ] 모든 테스트 통과 (`pnpm test:ci`)
- [ ] 버전 번호 결정 (semver 기준)

### Release 후

- [ ] main, develop 브랜치 푸시 완료
- [ ] 태그 푸시 완료
- [ ] 버전 동기화 확인 (`--check`)

## 문제 해결

| 문제            | 해결                                          |
| --------------- | --------------------------------------------- |
| git flow 미설치 | `brew install git-flow`                       |
| 버전 불일치     | `node scripts/sync-versions.mjs`              |
| 태그 충돌       | `git tag -d <tag>` 후 재시도                  |
| 머지 충돌       | 수동 해결 후 `git flow release finish` 재실행 |

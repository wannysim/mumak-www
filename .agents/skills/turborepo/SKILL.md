---
name: turborepo
description: Turborepo 모노레포 명령어, 필터 문법, 캐시 관리 가이드입니다. 특정 앱만 빌드/실행, 변경 감지, 캐시 문제 해결, CI/CD 설정 요청 시 사용합니다.
---

# Turborepo 사용 가이드

## 주요 명령어

### 개발

- `pnpm dev`: 모든 앱 개발 서버 실행
- `pnpm dev --filter=mumak-next`: 특정 앱만 실행

### 빌드

- `pnpm build`: 전체 빌드
- `pnpm build --filter=mumak-next`: 특정 앱만 빌드
- `pnpm build --filter=...mumak-next`: 앱과 의존성 모두 빌드

### 변경 감지

- `pnpm affected`: 변경된 부분만 빌드/테스트
- `pnpm affected:dry`: 실행 계획만 확인

### 디버깅

- `pnpm turbo:dry`: 실행될 태스크 미리 확인
- `pnpm turbo:graph`: 의존성 그래프 확인 (HTML 생성)
- `pnpm turbo run build --force`: 캐시 무시하고 실행
- `pnpm turbo:clean`: 모든 캐시 및 빌드 결과 삭제

### E2E (blog / Next standalone)

- `apps/blog`는 `output: standalone`을 사용하므로 CI E2E에서 `start:e2e`는 standalone 서버를 우선 사용
- CI에서는 standalone 산출물이 없으면 fail-fast 처리 (설정 누락 조기 감지)
- `test:e2e` 태스크에 `dependsOn: ["build"]`가 있으면 workflow에서 중복 `build` step을 줄여도 됨

## 필터 문법

### 기본 필터

- `--filter=mumak-next`: 특정 패키지만
- `--filter=...mumak-next`: 패키지 + 의존성 모두
- `--filter=mumak-next...`: 패키지 + dependents
- `--filter=!moomin-money`: 특정 패키지 제외

### Git 기반 필터

- `--filter=[HEAD^1]`: 현재 커밋과 이전 커밋 사이 변경
- `--filter=[main]`: main 브랜치 대비 변경
- `--filter=[origin/main...HEAD]`: origin/main과 HEAD 사이 변경

### 조합

- `--filter=...mumak-next --filter=!@mumak/ui`: 의존성 포함하되 특정 패키지 제외

## 캐시 관리

### 캐시 문제 해결

```bash
# 캐시 무시하고 실행
pnpm turbo run build --force

# 전체 캐시 삭제
pnpm turbo:clean
pnpm install
```

### Remote Cache 설정

GitHub Secrets 필요:

- `TURBO_TOKEN`: Turbo Cloud 토큰
- `TURBO_TEAM`: 팀 이름 (Variables)

## CI/CD 동작

### 변경 감지 전략

1. **paths 필터**: `apps/**`, `packages/**` 변경 시에만 실행
2. **detect-scopes**: 변경된 파일 분석 → 영향받는 앱 감지
3. **동적 matrix**: 감지된 앱별로 병렬 job 실행

### 앱 설정

`.github/app-config/apps.yml`에서 CI/CD 대상 앱 관리:

```yaml
apps:
  - app: blog
    type: next
    hasE2E: true
```

- `packages/**` 변경 시 모든 앱 포함
- `apps/{app}/**` 변경 시 해당 앱만 포함

## 문제 해결

| 문제                 | 해결                                                                            |
| -------------------- | ------------------------------------------------------------------------------- |
| 캐시가 잘못됨        | `pnpm turbo run build --force`                                                  |
| 패키지가 실행 안됨   | 해당 패키지에 스크립트 있는지 확인                                              |
| 의존성 확인          | `pnpm turbo:graph`                                                              |
| E2E 시작 실패 (blog) | `pnpm turbo run build --filter=blog` 후 `pnpm turbo run test:e2e --filter=blog` |

## 태스크 설정

| 태스크 유형 | outputs     | cache | 예시                  |
| ----------- | ----------- | ----- | --------------------- |
| 빌드        | 산출물 경로 | true  | `build`               |
| 검증        | `[]`        | true  | `lint`, `check-types` |
| 수정        | 생략        | false | `lint:fix`, `format`  |

### 포맷 체크 주의사항

- `turbo run format:check --filter=<app>`를 사용하려면 각 앱 `package.json`에 `format:check` 스크립트가 있어야 합니다.
- 스크립트가 없으면 Turbo가 해당 앱 태스크를 실행하지 못해 검증 공백이 생길 수 있습니다.

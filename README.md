# Mumak WWW

개인 프로젝트를 관리하는 Turborepo 모노레포입니다.

[![Dependabot Updates](https://github.com/wannysim/mumak-www/actions/workflows/dependabot/dependabot-updates/badge.svg)](https://github.com/wannysim/mumak-www/actions/workflows/dependabot/dependabot-updates)
[![CI](https://github.com/wannysim/mumak-www/actions/workflows/ci.yml/badge.svg)](https://github.com/wannysim/mumak-www/actions/workflows/ci.yml)
[![E2E Tests](https://github.com/wannysim/mumak-www/actions/workflows/e2e.yml/badge.svg)](https://github.com/wannysim/mumak-www/actions/workflows/e2e.yml)
[![codecov](https://codecov.io/github/wannysim/mumak-www/graph/badge.svg?token=QA0BJSHKID)](https://codecov.io/github/wannysim/mumak-www)
![Vercel Deploy](https://deploy-badge.vercel.app/vercel/mumak-www-blog?logo=next.js&name=wannysim.com)

## Apps

| 앱                  | 설명                                           | 로컬 URL                             |
| ------------------- | ---------------------------------------------- | ------------------------------------ |
| `apps/blog`         | FSD + MDX 기반 다국어 개인 블로그              | `http://blog.mumak.localhost:1355`   |
| `apps/mumak-next`   | Next.js App Router 샘플 애플리케이션           | `http://next.mumak.localhost:1355`   |
| `apps/mumak-react`  | Vite + React 샘플 애플리케이션                 | `http://react.mumak.localhost:1355`  |
| `apps/mumak-native` | Expo + expo-router 기반 모바일 앱과 web export | `http://native.mumak.localhost:1355` |

## Packages

| 패키지                     | 용도                                             |
| -------------------------- | ------------------------------------------------ |
| `@mumak/ui`                | shadcn/ui 기반 공유 컴포넌트 (웹 전용)           |
| `@mumak/shared`            | 플랫폼 무관 공유 로직 (hooks, utils, types, api) |
| `@mumak/typescript-config` | TypeScript 설정                                  |

## 시작하기

### 필수 요구사항

- Node.js 24.11.1+
- pnpm

### 설치

```bash
pnpm install
```

### 개발 서버 실행

각 앱의 `dev` 스크립트는 Portless proxy를 사용합니다.

```bash
# 모든 앱의 개발 서버 실행
pnpm dev

# 특정 앱만 실행
pnpm --filter=blog dev
pnpm --filter=mumak-next dev
pnpm --filter=mumak-react dev
pnpm --filter=mumak-native dev
```

로컬 proxy 상태가 꼬이면 다음 명령으로 정리한 뒤 다시 실행합니다.

```bash
pnpm exec portless proxy stop
```

## 프로젝트 구조

```text
mumak-www/
├── apps/
│   ├── blog/
│   ├── mumak-next/
│   ├── mumak-react/
│   └── mumak-native/
├── packages/
│   ├── ui/
│   ├── shared/
│   └── typescript-config/
├── AGENTS.md
├── package.json
└── turbo.json
```

## 개발 도구

### 코드 품질

- **Oxlint**: 코드 린팅
- **Oxfmt**: 코드 포맷팅
- **TypeScript**: 타입 체크
- **Husky**: Git 훅
- **lint-staged**: 스테이징된 파일만 린팅/포맷팅

### UI 시스템

- **shadcn/ui**: 재사용 가능한 UI 컴포넌트 라이브러리
- **Tailwind CSS**: 유틸리티 기반 CSS 프레임워크
- **Lucide React**: 아이콘 라이브러리
- **next-themes**: 다크모드 지원

## 주요 스크립트

```bash
# 개발 서버
pnpm dev

# 빌드
pnpm build

# 린팅 / 포맷
pnpm lint
pnpm lint:fix
pnpm format:check
pnpm format:fix
pnpm quality
pnpm quality:fix

# 타입 체크
pnpm check-types

# 테스트
pnpm test
pnpm test:coverage
pnpm test:ci
pnpm test:e2e

# 변경분 기준 검증
pnpm affected
pnpm affected:dry

# Turbo 디버깅
pnpm turbo:dry
pnpm turbo:graph
pnpm turbo:clean
```

개별 앱/패키지만 실행할 때는 pnpm filter를 사용합니다.

```bash
pnpm --filter=blog test
pnpm --filter=mumak-next test:e2e
pnpm --filter=mumak-react test:ui
pnpm --filter=mumak-native verify
```

## Turborepo

이 프로젝트는 Turborepo로 앱/패키지 태스크를 오케스트레이션합니다.

- **변경 감지**: PR에서 변경된 앱을 감지해 matrix를 구성
- **스마트 캐싱**: inputs/outputs 기반 캐싱
- **병렬 실행**: 의존성을 고려한 병렬 처리
- **개발자 도구**: dry-run, affected, graph 등

세부 필터 문법과 캐시 운영 규칙은 `.ai/skills/turborepo/SKILL.md`와 `AGENTS.md`의 Turborepo / CI 섹션을 참고합니다.

## 개발 환경 설정

### VS Code 확장 프로그램

프로젝트를 열면 다음 확장 프로그램이 권장됩니다:

- Oxc
- TypeScript
- Tailwind CSS IntelliSense

이 프로젝트는 에디터에서 `ESLint`/`Prettier` 대신 `oxc.oxc-vscode` 확장을 사용합니다.
워크스페이스 설정에서 Oxc를 기본 formatter와 lint fixer로 사용하도록 맞춰져 있습니다.

### 자동 포맷팅

저장 시 `oxc.oxc-vscode`가 포맷을 수행하고, Oxc lint fix와 import 정리가 함께 적용됩니다.

## 패키지 관리

### 새 앱 추가

가급적 `mumak-next`, `mumak-react`, `mumak-native` 중 가까운 앱을 보일러플레이트로 사용합니다.

복사가 완료되면 아래 요소를 수정합니다.

- `package.json`의 `name`
- 개발 서버 hostname과 Playwright 포트
- `.github/app-config/apps.yml`의 앱 등록
- nested `AGENTS.md`가 필요한지 여부

### 새 패키지 추가

```bash
mkdir packages/[package-name]
cd packages/[package-name]
pnpm init
```

### shadcn/ui 컴포넌트 추가

```bash
cd packages/ui
npx shadcn@latest add [component-name]
```

## 배포

각 앱은 독립적으로 빌드/배포할 수 있습니다.

```bash
pnpm turbo run build --filter=blog
```

`apps/blog`는 Vercel 배포 대상이고, `apps/mumak-native`의 네이티브 바이너리 빌드는 EAS Build 영역입니다.

## UI 컴포넌트 사용법

```typescript
import { Button } from '@mumak/ui/components/button';

<Button variant="default">Default</Button>
<Button variant="outline">Outline</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="destructive">Destructive</Button>
```

## CI/CD 파이프라인

### 워크플로우 구조

1. **CI 워크플로우** (`.github/workflows/ci.yml`)
   - root 품질 검사
   - 앱별 lint, format, type check, unit test, build
   - coverage artifact 업로드와 Codecov 업로드

2. **E2E 워크플로우** (`.github/workflows/e2e.yml`)
   - Playwright 기반 E2E
   - E2E가 켜진 앱만 matrix에 포함

### 트리거 조건

- **Pull Request**: summary check를 항상 만들기 위해 workflow는 실행하고, 내부 `detect-scopes`에서 영향 범위를 판단합니다.
- **Push**: `main`, `develop` 브랜치에 관련 경로가 변경될 때 실행합니다.
- **Manual dispatch**: `scopes` input으로 검증 앱을 직접 지정할 수 있습니다.

### 앱 설정

새 앱을 CI/CD에 포함하려면 `.github/app-config/apps.yml`에 등록합니다:

```yaml
apps:
  - app: new-app-name
    type: next # next, vite, expo, node 등
    hasE2E: true
    packageDependencies:
      - ui
      - typescript-config
```

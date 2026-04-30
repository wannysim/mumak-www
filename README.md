# Mumak WWW

개인 프로젝트를 관리하는 Turborepo 모노레포입니다.

## `apps/blog`

개인 블로그입니다.

[![Dependabot Updates](https://github.com/wannysim/mumak-www/actions/workflows/dependabot/dependabot-updates/badge.svg)](https://github.com/wannysim/mumak-www/actions/workflows/dependabot/dependabot-updates)[![CI](https://github.com/wannysim/mumak-www/actions/workflows/ci.yml/badge.svg)](https://github.com/wannysim/mumak-www/actions/workflows/ci.yml)
[![E2E Tests](https://github.com/wannysim/mumak-www/actions/workflows/e2e.yml/badge.svg)](https://github.com/wannysim/mumak-www/actions/workflows/e2e.yml)
[![codecov](https://codecov.io/github/wannysim/mumak-www/graph/badge.svg?token=QA0BJSHKID)](https://codecov.io/github/wannysim/mumak-www)
![Vercel Deploy](https://deploy-badge.vercel.app/vercel/mumak-www-blog?logo=next.js&name=wannysim.com)

## 🚀 시작하기

### 필수 요구사항

- Node.js 24.11.1+
- pnpm

### 설치

```bash
pnpm install
```

### 개발 서버 실행

```bash
# 모든 앱의 개발 서버 실행
pnpm dev

# 특정 앱만 실행
pnpm dev --filter=mumak-next
pnpm dev --filter=mumak-react
```

## 📁 프로젝트 구조

```md
mumak-www/
├── apps/ # 애플리케이션들
│ ├── mumak-next/ # Next.js 애플리케이션
│ └── mumak-react/ # Vite + React 애플리케이션
├── packages/ # 공유 패키지들
│ ├── ui/ # shadcn/ui 기반 UI 컴포넌트 라이브러리
│ └── typescript-config/ # TypeScript 설정
└── turbo.json # Turborepo 설정
```

## 🛠️ 개발 도구

### 코드 품질

- **Oxlint**: 코드 린팅
- **Oxfmt**: 코드 포맷팅
- **TypeScript**: 타입 체크
- **Husky**: Git 훅
- **lint-staged**: 스테이징된 파일만 린팅

### UI 시스템

- **shadcn/ui**: 재사용 가능한 UI 컴포넌트 라이브러리
- **Tailwind CSS**: 유틸리티 기반 CSS 프레임워크
- **Lucide React**: 아이콘 라이브러리
- **next-themes**: 다크모드 지원

### 사용 가능한 스크립트

```bash
# 빌드
pnpm build

# 린팅
pnpm lint

# 타입 체크
pnpm check-types

# 포맷팅 체크
pnpm format

# 코드 포맷팅 적용
pnpm format:fix

# 포맷팅 체크 (별칭)
pnpm format:check

# 개발 서버
pnpm dev

# 루트 품질 검사
pnpm quality

# 루트 품질 자동 수정
pnpm quality:fix

# 테스트
pnpm test              # 모든 앱의 단위 테스트 실행
pnpm test:coverage     # 커버리지 포함 테스트 실행
pnpm test:ci          # CI 환경용 테스트 실행
pnpm test:e2e         # 모든 앱의 E2E 테스트 실행

# 개별 앱 테스트
pnpm --filter=mumak-next test
pnpm --filter=mumak-react test
pnpm --filter=mumak-react test:ui    # Vitest UI 실행
pnpm --filter=mumak-react test:e2e:ui # Playwright UI 실행

# 변경분 기준 검증
pnpm affected
pnpm affected:dry
```

### Pre-commit 훅

커밋 시 자동으로 다음 작업이 실행됩니다:

- Oxlint 검사 및 자동 수정
- Oxfmt 포맷팅

## ⚡ Turborepo 최적화

이 프로젝트는 Turborepo의 다양한 기능을 활용하여 최적화되어 있습니다:

- **변경 감지**: PR에서 변경된 패키지만 빌드/테스트
- **스마트 캐싱**: inputs/outputs 기반 정교한 캐싱
- **병렬 실행**: 의존성을 고려한 최적 병렬 처리
- **개발자 도구**: dry-run, affected, graph 등

자세한 사용법은 [TURBOREPO.md](./TURBOREPO.md)를 참고하세요.

## 🔧 개발 환경 설정

### VS Code 확장 프로그램

프로젝트를 열면 다음 확장 프로그램이 권장됩니다:

- Oxc
- TypeScript
- Tailwind CSS IntelliSense

이 프로젝트는 에디터에서 `ESLint`/`Prettier` 대신 `oxc.oxc-vscode` 확장을 사용합니다.
워크스페이스 설정에서 Oxc를 기본 formatter와 lint fixer로 사용하도록 맞춰져 있습니다.

### 자동 포맷팅

저장 시 `oxc.oxc-vscode`가 포맷을 수행하고, Oxc lint fix와 import 정리가 함께 적용됩니다.

## 📦 패키지 관리

### 새 앱 추가

가급적 `mumak-next`나 `mumak-react`를 보일러플레이트로서 사용합니다.

```bash
# apps 디렉토리에 새 Next.js 앱 생성
pnpm create next-app apps/[app-name]

# 또는 기존 mumak-next를 복사해서 새 앱 생성
cp -r apps/mumak-next apps/[app-name]

# Vite + React 앱 생성 (mumak-react 참고)
cp -r apps/mumak-react apps/[app-name]
```

> 복사가 완료되면, 아래 요소를 수정합니다.
>
> - `package.json` 내 `name`
> - 개발서버 & Playwright 포트 번호
> - `.github/app-config/apps.yml`에 앱 등록 (CI/CD 포함)

### 새 패키지 추가

```bash
# packages 디렉토리에 새 패키지 생성
mkdir packages/[package-name]
cd packages/[package-name]
pnpm init
```

### shadcn/ui 컴포넌트 추가

```bash
# UI 패키지에 새 컴포넌트 추가
cd packages/ui
npx shadcn@latest add [component-name]
```

## 🚀 배포

각 앱은 독립적으로 배포할 수 있습니다:

```bash
# 특정 앱 빌드
pnpm build --filter=mumak-next

# 특정 앱 배포
pnpm deploy --filter=mumak-next
```

## 🎨 UI 컴포넌트 사용법

```typescript
// Button 컴포넌트 사용
import { Button } from '@mumak/ui/components/button';

// 다양한 variant 지원
<Button variant="default">Default</Button>
<Button variant="outline">Outline</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="destructive">Destructive</Button>
```

## 🔄 CI/CD 파이프라인

### 워크플로우 구조

프로젝트는 두 개의 독립적인 GitHub Actions 워크플로우로 구성되어 있습니다:

1. **CI 워크플로우** (`.github/workflows/ci.yml`)
   - 린팅, 타입 체크, 단위 테스트, 빌드
   - 변경된 앱별로 병렬 실행 (동적 matrix)

2. **E2E 워크플로우** (`.github/workflows/e2e.yml`)
   - Playwright를 사용한 E2E 테스트
   - 앱 x 브라우저 조합별 병렬 실행

### 트리거 조건

- **paths 필터**: `apps/**`, `packages/**` 변경 시에만 실행
- **Pull Request**: PR 생성/업데이트 시 변경된 앱만 검증
- **Push**: `main`, `develop` 브랜치에 푸시 시 실행

### 앱 설정

새 앱을 CI/CD에 포함하려면 `.github/app-config/apps.yml`에 등록합니다:

```yaml
apps:
  - app: new-app-name
    type: next # or vite, node
    hasE2E: true # E2E 테스트 포함 여부
```

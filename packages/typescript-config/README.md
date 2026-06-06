# @mumak/typescript-config

Monorepo 전체에서 공유되는 TypeScript 설정을 제공합니다.

## 사용 가능한 설정

### base.json

기본 TypeScript 설정입니다. 모든 환경의 기초가 되는 공통 컴파일러 옵션을 포함합니다.

**특징**:

- Target: ES2023
- 엄격한 타입 체크 (`strict: true`)
- Linting 규칙 활성화
- 선택적 체이닝 등 최신 TypeScript 기능 지원

**사용 대상**: 다른 모든 설정의 기반

### nextjs.json

Next.js 애플리케이션을 위한 설정입니다. `base.json`을 상속하고 Next.js 플러그인과 관련 옵션을 추가합니다.

**특징**:

- JSX 처리: `preserve` (Next.js에서 처리)
- 모듈 해석: Bundler 모드
- Next.js 플러그인 활성화
- JS 파일 허용

**사용 대상**: Next.js 앱 (예: `apps/mumak-next`)

**예시**:

```json
{
  "extends": "@mumak/typescript-config/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@mumak/ui/*": ["../../packages/ui/src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### react-library.json

React 컴포넌트 라이브러리를 위한 설정입니다. `base.json`을 상속하고 React JSX 처리만 추가합니다.

**특징**:

- JSX 처리: `react-jsx`
- 선언 파일 생성 지원

**사용 대상**: React UI 라이브러리 (예: `packages/ui`)

**예시**:

```json
{
  "extends": "@mumak/typescript-config/react-library.json"
}
```

### react-vite.json

React + Vite 환경을 위한 설정입니다. `base.json`을 상속하고 Vite 번들러 모드와 React JSX 처리를 추가합니다.

**특징**:

- 모듈 해석: Bundler 모드
- JSX 처리: `react-jsx`
- Import Extensions 허용
- 모듈 호환성 옵션 (esModuleInterop, allowSyntheticDefaultImports)

**사용 대상**: Vite 기반 React 앱 (예: `apps/mumak-react`)

**예시**:

```json
{
  "extends": "@mumak/typescript-config/react-vite.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@mumak/ui/*": ["../../packages/ui/src/*"]
    }
  },
  "include": ["src", "vite.config.ts", "vitest.config.js", "playwright.config.ts"],
  "exclude": ["node_modules"]
}
```

## 설정 계층 구조

```bash
base.json #기본 컴파일러 옵션
├── nextjs.json #Next.js 전용 옵션 + base
├── react-library.json #React 라이브러리 옵션 + base
└── react-vite.json #React+Vite 옵션 + base

각 앱의 tsconfig.json #경로 매핑 + include/exclude
```

## 책임 분리

| 계층          | 정의 위치              | 내용                                   |
| ------------- | ---------------------- | -------------------------------------- |
| **공유 설정** | `*.json`               | 컴파일러 옵션 (target, module, jsx 등) |
| **앱 설정**   | `apps/*/tsconfig.json` | 경로 매핑, include/exclude             |

### 공유 설정의 책임

- 환경별 컴파일러 옵션 정의
- 타입 체크 규칙 설정
- 번들러/모듈 해석 방식 결정

### 앱 설정의 책임

- `baseUrl`, `paths`: 앱별 경로 별칭 정의
- `include`: 앱이 컴파일할 파일 지정
- `exclude`: 컴파일 제외 파일 지정

## 마이그레이션 가이드

기존 앱을 통합 설정으로 마이그레이션하려면:

### Step 1: 공유 설정 상속

앱의 `tsconfig.json`에 `extends` 필드를 추가합니다:

```json
{
  "extends": "@mumak/typescript-config/react-vite.json"
}
```

### Step 2: 앱별 설정 추가

앱의 구조에 맞게 경로 매핑과 include/exclude를 정의합니다:

```json
{
  "extends": "@mumak/typescript-config/react-vite.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@mumak/ui/*": ["../../packages/ui/src/*"]
    }
  },
  "include": ["src", "vite.config.ts", "vitest.config.js", "playwright.config.ts"],
  "exclude": ["node_modules"]
}
```

### Step 3: 기존 설정 파일 제거

분리된 설정 파일들을 제거합니다:

- `tsconfig.app.json`
- `tsconfig.node.json`
- 기타 환경별 분리 파일

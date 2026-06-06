# Mumak React

Vite + React + TypeScript로 구성된 샘플 웹 애플리케이션입니다.

## 개발 환경

- Node.js 24.11.1+
- pnpm

## 설치 및 실행

의존성은 워크스페이스 루트에서 설치합니다.

```bash
pnpm install
```

루트에서 실행할 때:

```bash
pnpm --filter=mumak-react dev
pnpm --filter=mumak-react build
pnpm --filter=mumak-react preview
```

앱 디렉터리에서 실행할 때:

```bash
pnpm dev
pnpm build
pnpm preview
```

개발 서버는 Portless를 사용하며 기본 URL은 `http://react.mumak.localhost:1355`입니다.
E2E/CI용 preview 포트는 `3001`입니다.

## 테스트

이 앱은 Vitest와 Playwright를 사용합니다.

```bash
# 단위 테스트
pnpm test
pnpm test:watch
pnpm test:ui
pnpm test:run
pnpm test:coverage
pnpm test:ci

# E2E 테스트
pnpm test:e2e
pnpm test:e2e:ui
pnpm test:e2e:headed
pnpm test:e2e:debug
```

루트에서 특정 앱만 검증하려면 filter를 사용합니다.

```bash
pnpm --filter=mumak-react test:ci
pnpm --filter=mumak-react test:e2e
```

## 파일 구조

```text
apps/mumak-react/
├── src/
│   ├── components/      # 앱 전용 컴포넌트
│   ├── test/            # 테스트 설정
│   ├── __tests__/       # Vitest 단위 테스트
│   ├── app.tsx
│   └── main.tsx
├── e2e/                 # Playwright E2E 테스트
├── index.html
├── playwright.config.ts
├── vite.config.ts
├── vitest.config.js
└── tsconfig.json
```

## 테스트 작성 예시

### 단위 테스트

```typescript
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { YourComponent } from '../components/your-component';

describe('YourComponent', () => {
  it('should render correctly', () => {
    render(<YourComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

### E2E 테스트

```typescript
import { expect, test } from '@playwright/test';

test('should render home page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
});
```

# Mumak Next

Next.js App Router + TypeScript로 구성된 샘플 웹 애플리케이션입니다.

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
pnpm --filter=mumak-next dev
pnpm --filter=mumak-next build
pnpm --filter=mumak-next start
```

앱 디렉터리에서 실행할 때:

```bash
pnpm dev
pnpm build
pnpm start
```

개발 서버는 Portless를 사용하며 기본 URL은 `http://next.mumak.localhost:1355`입니다.
E2E/CI용 `start` 포트는 `3000`입니다.

## 테스트

이 앱은 Jest와 Playwright를 사용합니다.

```bash
# 단위 테스트
pnpm test
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
pnpm --filter=mumak-next test:ci
pnpm --filter=mumak-next test:e2e
```

## 파일 구조

```text
apps/mumak-next/
├── app/                 # App Router
├── components/          # 앱 전용 컴포넌트
├── __tests__/           # Jest 단위 테스트
├── e2e/                 # Playwright E2E 테스트
├── jest.config.mjs
├── jest.setup.ts
├── next.config.mjs
├── playwright.config.ts
└── tsconfig.json
```

## 테스트 작성 예시

### 단위 테스트

```typescript
import { render, screen } from '@testing-library/react';

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

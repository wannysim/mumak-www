---
name: test-writer
description: Jest, Vitest, Playwright를 활용한 테스트 작성 가이드입니다. 단위 테스트, 통합 테스트, E2E 테스트 작성 요청 시 사용합니다.
---

# Test Writer Guide

이 프로젝트의 테스트 작성 규칙과 패턴을 정의합니다.

## 테스트 도구 선택

| 앱          | 단위/통합 테스트 | E2E 테스트 |
| ----------- | ---------------- | ---------- |
| mumak-next  | Jest             | Playwright |
| mumak-react | Vitest           | Playwright |
| blog        | Jest             | Playwright |
| packages/ui | Vitest           | -          |

## 파일 위치 규칙

```
apps/mumak-next/
├── __tests__/           # 단위/통합 테스트
│   └── components/
│       └── Button.test.tsx
└── e2e/                 # E2E 테스트
    └── home.spec.ts

packages/ui/
└── src/components/
    └── button/
        ├── button.tsx
        └── button.test.tsx  # 컴포넌트와 같은 위치
```

## 단위 테스트 패턴 (Jest/Vitest)

### 컴포넌트 테스트

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn(); // or jest.fn()
    render(<Button onClick={handleClick}>Click</Button>);

    await userEvent.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('applies variant styles', () => {
    render(<Button variant="outline">Outline</Button>);
    expect(screen.getByRole('button')).toHaveClass('border');
  });
});
```

### 훅 테스트

```typescript
import { renderHook, act } from '@testing-library/react';
import { useCounter } from './use-counter';

describe('useCounter', () => {
  it('increments counter', () => {
    const { result } = renderHook(() => useCounter());

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });
});
```

## E2E 테스트 패턴 (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays main heading', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('navigates to about page', async ({ page }) => {
    await page.getByRole('link', { name: /about/i }).click();
    await expect(page).toHaveURL('/about');
  });
});
```

## 테스트 작성 원칙

### AAA 패턴

- **Arrange**: 테스트 환경 설정
- **Act**: 테스트 대상 실행
- **Assert**: 결과 검증

### 테스트 명명

- `it('동사 + 기대 결과')` 형식
- 한글 사용 가능: `it('버튼 클릭 시 모달이 열린다')`

### 쿼리 우선순위

1. `getByRole` - 접근성 기반 (권장)
2. `getByLabelText` - 폼 요소
3. `getByText` - 텍스트 콘텐츠
4. `getByTestId` - 최후의 수단

## 체크리스트

- [ ] 테스트가 독립적으로 실행 가능한가?
- [ ] AAA 패턴을 따르는가?
- [ ] getByRole을 우선 사용했는가?
- [ ] 비동기 동작에 await를 사용했는가?
- [ ] 적절한 위치에 파일이 있는가?

---
name: react-component-generator
description: shadcn/ui 기반 React 컴포넌트를 일관된 구조로 생성합니다. 새 컴포넌트 생성, UI 컴포넌트 추가, 버튼/폼/카드 등 UI 요소 구현 요청 시 사용합니다.
---

# React Component Generator

이 프로젝트의 컴포넌트 생성 규칙을 따르는 skill입니다. shadcn/ui 패턴과 TypeScript를 기반으로 일관된 컴포넌트를 생성합니다.

## 컴포넌트 위치 규칙

| 유형         | 위치                                    | 설명                         |
| ------------ | --------------------------------------- | ---------------------------- |
| 공유 UI      | `packages/ui/src/components/`           | 여러 웹 앱에서 재사용        |
| Next.js 전용 | `apps/mumak-next/components/`           | mumak-next 앱 전용           |
| React 전용   | `apps/mumak-react/src/components/`      | Vite 앱 전용                 |
| Blog 전용    | `apps/blog/src/{widgets,features,...}/` | FSD 레이어와 모듈에 colocate |

`apps/blog`는 FSD 구조를 따르므로 `src/widgets/{module}/ui/{component}.tsx`, `src/features/{module}/ui/{component}.tsx`, `src/shared/ui/{component}.tsx` 중 책임에 맞는 위치에 둔다.

## 컴포넌트 구조 템플릿

```typescript
import * as React from 'react';

import { cn } from '@mumak/ui/lib/utils';

function ComponentName({
  className,
  children,
  variant = 'default',
  ...props
}: React.ComponentProps<'div'> & {
  variant?: 'default' | 'outline';
}) {
  return (
    <div
      className={cn('base-styles-here', variant === 'outline' && 'outline-styles', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { ComponentName };
```

## 필수 규칙

### 타입 정의

- 별도 `interface`보다 `React.ComponentProps<>` 조합을 우선한다.
- variant/size 등은 유니온 타입 또는 `class-variance-authority`의 `VariantProps`로 제한한다.
- shadcn/ui primitive는 Radix primitive props 타입을 그대로 확장한다.

### 스타일링

- Tailwind CSS 유틸리티 클래스를 사용한다.
- className 합성은 `cn()`을 경유한다.
- `cn`은 `@mumak/ui/lib/utils`에서 가져온다.
- 인라인 스타일은 동적 값이 필요한 경우에만 사용한다.

### 네이밍

- 컴포넌트: PascalCase (`UserProfile`)
- 파일명: kebab-case (`user-profile.tsx`)
- 테스트 파일: `{component}.test.tsx`

### 구조

- 재사용 컴포넌트는 named export를 사용한다.
- variants 선언은 컴포넌트 함수보다 위에 둔다.
- `...props` spread로 네이티브 속성을 전달한다.
- `packages/ui` 컴포넌트는 `data-slot`을 추가한다.

## 체크리스트

- [ ] 책임에 맞는 앱/패키지 디렉터리에 위치하는가?
- [ ] 파일명이 kebab-case인가?
- [ ] props가 `React.ComponentProps<>` 기반인가?
- [ ] className을 `cn()`으로 병합하는가?
- [ ] named export를 사용하는가?
- [ ] `packages/ui`라면 `data-slot`을 추가했는가?

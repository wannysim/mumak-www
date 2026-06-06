---
name: react-component-generator
description: shadcn/ui 기반 React 컴포넌트를 일관된 구조로 생성합니다. 새 컴포넌트 생성, UI 컴포넌트 추가, 버튼/폼/카드 등 UI 요소 구현 요청 시 사용합니다.
---

# React Component Generator

이 프로젝트의 컴포넌트 생성 규칙을 따르는 skill입니다. shadcn/ui 패턴과 TypeScript를 기반으로 일관된 컴포넌트를 생성합니다. 공통 규칙은 루트 `AGENTS.md`의 "React 컴포넌트 패턴"을 따른다.

## 컴포넌트 위치 규칙

| 유형         | 위치                                                     | 설명                             |
| ------------ | -------------------------------------------------------- | -------------------------------- |
| 공유 UI      | `packages/ui/src/components/`                            | 여러 앱에서 재사용 (shadcn 기반) |
| Next.js 전용 | `apps/mumak-next/components/`                            | Next.js 앱 전용                  |
| React 전용   | `apps/mumak-react/src/components/`                       | Vite 앱 전용                     |
| Blog 전용    | `apps/blog/src/{widgets,features,entities,shared}/*/ui/` | Blog 앱은 FSD 구조               |

### Blog (FSD) 배치 가이드

`apps/blog`는 Feature-Sliced Design을 쓴다. `apps/blog/components/`는 존재하지 않는다.

- 여러 섹션에서 재사용하는 presentational primitive → `src/shared/ui/`
- 도메인 기능 묶음 → `src/features/<feature>/ui/`
- 복합 화면 블록(카드, nav, header 등) → `src/widgets/<widget>/ui/`
- 모듈 구조: `<module>/ui/<component>.tsx` + `<module>/index.ts`(barrel) + `<module>/__tests__/`
- 자세한 규칙은 `apps/blog/AGENTS.md` 참조.

## 컴포넌트 구조 템플릿

`React.ComponentProps<>`로 네이티브 속성을 확장하고, 별도 `interface`/`type` Props 정의는 지양한다(루트 규칙). `cn`은 `@mumak/ui/lib/utils`에서 가져온다.

```tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@mumak/ui/lib/utils';

const componentVariants = cva('base-styles-here', {
  variants: {
    variant: { default: '', outline: 'outline-styles' },
    size: { sm: 'text-sm', md: 'text-base', lg: 'text-lg' },
  },
  defaultVariants: { variant: 'default', size: 'md' },
});

function ComponentName({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof componentVariants>) {
  return <div className={cn(componentVariants({ variant, size }), className)} {...props} />;
}

export { ComponentName, componentVariants };
```

variant가 필요 없는 단순 컴포넌트는 `cva` 없이 작성한다.

```tsx
import * as React from 'react';

import { cn } from '@mumak/ui/lib/utils';

function Callout({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('rounded-lg border border-border p-4', className)} {...props} />;
}

export { Callout };
```

## 필수 규칙

### 타입 정의

- Props는 **`React.ComponentProps<'element'>`** 로 네이티브 속성을 확장한다. 별도 `interface ComponentNameProps`는 만들지 않는다.
- variant/size 등 디자인 변형은 `cva` + `VariantProps`로 표현한다.
- shadcn/ui primitive는 Radix primitive props 타입을 그대로 확장한다.
- `any` 캐스팅 금지.

### 스타일링

- Tailwind v4 + shadcn/ui semantic token만 사용한다 (`bg-muted`, `text-muted-foreground`, `border-border` 등).
- raw 팔레트(`text-blue-500`, `bg-red-*`)와 임의 `dark:` 색상 override를 직접 쓰지 않는다.
- `cn()`(`@mumak/ui/lib/utils`)으로 조건부 클래스를 병합한다.
- 인라인 스타일은 동적 값이 필요한 경우에만 사용한다.

### 네이밍

- 컴포넌트 export 이름: PascalCase (`UserProfile`)
- 파일명: kebab-case (`user-profile.tsx`) — Blog의 `ui/` 내부도 kebab-case
- variants 상수: `<component>Variants` (`buttonVariants`)

### 구조

- **named export** 사용 (Next.js 페이지/레이아웃·설정 파일만 default export).
- export는 파일 끝에서 모아서 한다 (`export { ComponentName, componentVariants }`).
- props destructuring + `...props` spread로 확장성 확보.
- `packages/ui` 컴포넌트는 `data-slot`을 추가한다.
- 클라이언트 훅이 필요할 때만 `'use client'`를 맨 위에 둔다.

## 체크리스트

- [ ] Props를 `React.ComponentProps<>`로 정의했는가? (별도 interface 금지)
- [ ] variant가 있으면 `cva` + `VariantProps`를 썼는가?
- [ ] semantic token만 사용하고 raw 색상/임의 `dark:`를 피했는가?
- [ ] `cn`을 `@mumak/ui/lib/utils`에서 가져왔는가?
- [ ] FSD 레이어(blog) 또는 올바른 앱 디렉터리에 배치했는가?
- [ ] `packages/ui`라면 `data-slot`을 추가했는가?
- [ ] named export + 파일 끝 export를 사용하는가?

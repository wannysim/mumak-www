---
name: react-component-generator
description: shadcn/ui 기반 React 컴포넌트를 일관된 구조로 생성합니다. 새 컴포넌트 생성, UI 컴포넌트 추가, 버튼/폼/카드 등 UI 요소 구현 요청 시 사용합니다.
---

# React Component Generator

이 프로젝트의 컴포넌트 생성 규칙을 따르는 skill입니다. shadcn/ui 패턴과 TypeScript를 기반으로 일관된 컴포넌트를 생성합니다.

## 컴포넌트 위치 규칙

| 유형         | 위치                               | 설명               |
| ------------ | ---------------------------------- | ------------------ |
| 공유 UI      | `packages/ui/src/components/`      | 여러 앱에서 재사용 |
| Next.js 전용 | `apps/mumak-next/components/`      | Next.js 앱 전용    |
| React 전용   | `apps/mumak-react/src/components/` | Vite 앱 전용       |
| Blog 전용    | `apps/blog/components/`            | Blog 앱 전용       |

## 컴포넌트 구조 템플릿

```typescript
import { type ComponentProps } from 'react';
import { cn } from '@/lib/utils';

interface ComponentNameProps extends ComponentProps<'div'> {
  variant?: 'default' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export const ComponentName = ({
  variant = 'default',
  size = 'md',
  className,
  children,
  ...props
}: ComponentNameProps) => {
  return (
    <div
      className={cn(
        'base-styles-here',
        variant === 'outline' && 'outline-styles',
        size === 'sm' && 'text-sm',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
```

## 필수 규칙

### 타입 정의

- `interface`로 Props 정의 (type 대신)
- `ComponentProps<'element'>`로 네이티브 속성 확장
- variant/size 등은 유니온 타입으로 제한

### 스타일링

- Tailwind CSS 유틸리티 클래스 사용
- `cn()` 함수로 조건부 클래스 병합
- 인라인 스타일 사용 금지

### 네이밍

- 컴포넌트: PascalCase (`UserProfile`)
- 파일명: kebab-case (`user-profile.tsx`)
- Props: ComponentName + Props (`UserProfileProps`)

### 구조

- named export 사용 (default export 금지)
- props destructuring with defaults
- `...props` spread로 확장성 확보

## 체크리스트

- [ ] Props 인터페이스가 명시적으로 정의되었는가?
- [ ] className prop을 cn()으로 병합하는가?
- [ ] 적절한 디렉토리에 위치하는가?
- [ ] named export를 사용하는가?

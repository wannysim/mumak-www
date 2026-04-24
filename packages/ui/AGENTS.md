# AGENTS.md — `@mumak/ui`

shadcn/ui 기반 공유 컴포넌트 패키지. 루트 [`AGENTS.md`](../../AGENTS.md)의 모든 규칙이 적용되며, 이 파일은 `packages/ui/` 하위에서만 추가로 적용되는 규칙을 정의한다.

---

## 파일 구조

- 모든 컴포넌트는 `src/components/` 아래 단일 파일로 둔다.
- barrel export (`index.ts`)를 **사용하지 않는다**.
- `package.json`의 `exports` 필드로 각 컴포넌트를 직접 노출한다.

```json
{
  "exports": {
    "./components/*": "./src/components/*.tsx",
    "./lib/utils": "./src/lib/utils.ts",
    "./globals.css": "./src/globals.css"
  }
}
```

## Import 규칙

```typescript
// Good — 컴포넌트별 직접 import
import { Button } from '@mumak/ui/components/button';
import { Card, CardHeader } from '@mumak/ui/components/card';

// Bad — barrel import 없음
import { Button } from '@mumak/ui';
```

## shadcn/ui 패턴

### Radix Primitives

클라이언트 상호작용이 있는 컴포넌트는 `'use client'`를 파일 상단에 둔다.

```typescript
'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
```

### Variants (`cva`)

variants 선언은 컴포넌트 함수보다 **위에** 둔다.

```typescript
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva('base-classes...', {
  variants: {
    variant: { default: '...', destructive: '...' },
    size: { default: '...', sm: '...' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});
```

### `data-slot` 속성

모든 컴포넌트(및 내부 서브파트)에 식별용 `data-slot`을 추가한다.

```typescript
<button data-slot="button" className={...} {...props} />
<div data-slot="card-header" className={...} {...props} />
```

### `cn` 유틸리티

className 합성은 반드시 `cn`을 경유한다.

```typescript
import { cn } from '@mumak/ui/lib/utils';

className={cn(buttonVariants({ variant, size }), className)}
```

## Props 패턴

루트 AGENTS.md의 `React.ComponentProps<>` 규칙을 따른다. shadcn 컴포넌트에서는 주로 Radix primitive 타입을 그대로 확장한다.

```typescript
function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  // ...
}
```

## Export

파일 끝에서 named export. variants가 있다면 함께 export한다.

```typescript
export { Button, buttonVariants };
export { Card, CardHeader, CardFooter, CardTitle, CardContent };
```

## 체크리스트

새 컴포넌트를 추가할 때:

- [ ] `src/components/{kebab-case}.tsx` 단일 파일에 있는가?
- [ ] `package.json`의 `exports`로 노출되는가? (pattern export로 자동 노출되는지 확인)
- [ ] 모든 요소에 `data-slot`이 붙어 있는가?
- [ ] className 합성이 `cn()`을 경유하는가?
- [ ] 별도 `interface` 없이 `React.ComponentProps<>`로 props를 정의했는가?
- [ ] named export인가? (default export 금지)
---
name: perf-optimization
description: React와 Next.js 애플리케이션의 렌더링 성능을 최적화합니다. 성능 개선, 최적화, 느린 렌더링, 번들 사이즈 감소 요청 시 사용합니다.
---

# Performance Optimization Guide

React 19 + Next.js 15 환경에서의 성능 최적화 전략입니다.

## 렌더링 최적화

### 불필요한 리렌더링 방지

```typescript
// Bad: 매 렌더링마다 새 객체 생성
<Component style={{ color: 'red' }} />

// Good: 객체를 외부로 추출
const redStyle = { color: 'red' };
<Component style={redStyle} />
```

### React.memo 사용

```typescript
// 자식 컴포넌트가 동일한 props로 자주 리렌더링될 때
const ExpensiveList = memo(({ items }: Props) => {
  return items.map(item => <Item key={item.id} {...item} />);
});
```

### useMemo / useCallback

```typescript
// 계산 비용이 큰 값
const sortedItems = useMemo(() => items.toSorted((a, b) => a.name.localeCompare(b.name)), [items]);

// 자식에게 전달하는 콜백
const handleClick = useCallback((id: string) => {
  setSelected(id);
}, []);
```

## Next.js 최적화

### 이미지 최적화

```typescript
import Image from 'next/image';

// priority: LCP 이미지에만 사용
<Image
  src="/hero.jpg"
  alt="Hero"
  width={1200}
  height={600}
  priority  // Above-the-fold 이미지만
/>

// 일반 이미지는 lazy loading (기본값)
<Image
  src="/feature.jpg"
  alt="Feature"
  width={400}
  height={300}
  loading="lazy"
/>
```

### 폰트 최적화

```typescript
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});
```

### 코드 스플리팅

```typescript
import dynamic from 'next/dynamic';

// 무거운 컴포넌트 지연 로딩
const HeavyChart = dynamic(() => import('./HeavyChart'), {
  loading: () => <ChartSkeleton />,
  ssr: false, // 클라이언트 전용이면
});
```

## RSC (React Server Components) 활용

### 데이터 페칭은 서버에서

```typescript
// app/posts/page.tsx (Server Component)
export default async function PostsPage() {
  const posts = await fetchPosts(); // 서버에서 직접 호출

  return <PostList posts={posts} />;
}
```

### 클라이언트 컴포넌트 최소화

```typescript
// 인터랙션이 필요한 부분만 'use client'
'use client';

export const LikeButton = ({ postId }: Props) => {
  const [liked, setLiked] = useState(false);
  // ...
};
```

### Serialized Props 크기 주의

```typescript
// Bad: 전체 객체 전달
<ClientComponent data={hugeObject} />

// Good: 필요한 필드만 전달
<ClientComponent
  id={hugeObject.id}
  title={hugeObject.title}
/>
```

## 체크리스트

### 렌더링

- [ ] 불필요한 리렌더링이 발생하지 않는가?
- [ ] 인라인 객체/함수가 최소화되었는가?
- [ ] memo/useMemo/useCallback이 적절히 사용되었는가?

### Next.js

- [ ] LCP 이미지에만 priority를 사용하는가?
- [ ] 무거운 컴포넌트가 dynamic import 되었는가?
- [ ] next/font로 폰트가 최적화되었는가?

### RSC

- [ ] 데이터 페칭이 서버 컴포넌트에서 이루어지는가?
- [ ] 'use client'가 필요한 곳에만 사용되는가?
- [ ] 클라이언트로 전달되는 props 크기가 최소화되었는가?

## 디버깅 도구

```bash
# 번들 분석
pnpm --filter mumak-next build
pnpm --filter mumak-next analyze

# React DevTools Profiler
# - Highlight updates 켜고 리렌더링 확인
# - Flamegraph로 렌더링 시간 측정
```

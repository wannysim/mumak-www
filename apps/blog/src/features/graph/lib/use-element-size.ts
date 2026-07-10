'use client';

import * as React from 'react';

// 컨테이너 크기를 ResizeObserver로 추적한다. ForceGraph는 명시적 width/height가
// 필요하므로 초기값을 두고 관측값으로 갱신한다.
export function useElementSize(initial: { width: number; height: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState(initial);

  React.useEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width: Math.floor(width), height: Math.floor(height) });
      }
    });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}

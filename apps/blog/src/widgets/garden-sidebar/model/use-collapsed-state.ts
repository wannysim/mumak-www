'use client';

import * as React from 'react';

const COLLAPSED_STORAGE_KEY = 'garden-sidebar-collapsed';

// 접힘 상태는 hydration 후 localStorage로 복원한다. 접어둔 사용자가 재방문하면
// 첫 프레임에 펼침→접힘 깜빡임이 생길 수 있다. 없애려면 theme처럼 inline script로 승격.
export function useCollapsedState(): [boolean, (next: boolean) => void] {
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    try {
      if (localStorage.getItem(COLLAPSED_STORAGE_KEY) === '1') setCollapsed(true);
    } catch {}
  }, []);

  const updateCollapsed = React.useCallback((next: boolean) => {
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? '1' : '0');
    } catch {}
  }, []);

  return [collapsed, updateCollapsed];
}

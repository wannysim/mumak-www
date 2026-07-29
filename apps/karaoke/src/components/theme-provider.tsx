import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { LOCAL_STORAGE_KEYS } from '@/lib/client-storage';

type Theme = 'dark' | 'light';

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState>({
  theme: 'dark',
  setTheme: () => null,
});

function deviceTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({
  children,
  storageKey = LOCAL_STORAGE_KEYS.theme,
}: {
  children: React.ReactNode;
  storageKey?: string;
}) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // 기기 설정은 최초 접속의 출발점일 뿐이다. 한 번 고르고 나면 그 선택을 그대로 지킨다.
    const stored = localStorage.getItem(storageKey);
    return stored === 'dark' || stored === 'light' ? stored : deviceTheme();
  });

  useEffect(() => {
    // index.html의 인라인 스크립트가 첫 페인트 전에 같은 일을 해 둔다. 여기서는 이후 변경만 반영한다.
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.style.colorScheme = theme;
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme: (next: Theme) => {
        localStorage.setItem(storageKey, next);
        setThemeState(next);
      },
    }),
    [theme, storageKey]
  );

  return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>;
}

export const useTheme = () => useContext(ThemeProviderContext);

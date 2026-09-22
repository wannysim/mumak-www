import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type Theme = 'dark' | 'light';

const STORAGE_KEY = 'mumak-quant-theme';

const ThemeContext = createContext({
  theme: 'light' as Theme,
  setTheme: (_theme: Theme): void => undefined,
});

function deviceTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// 테마 선호는 포트폴리오 데이터가 아니므로 localStorage에 남긴다.
// 프라이빗 모드나 저장소 차단 환경에서 접근 자체가 throw할 수 있어 모든 접근을 감싼다.
function storedTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : null;
  } catch {
    return null;
  }
}

function rememberTheme(theme: Theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 저장에 실패해도 이번 세션의 테마는 그대로 유지한다.
  }
}

function ThemeProvider({ children }: React.ComponentProps<'div'>) {
  const [theme, setTheme] = useState<Theme>(() => storedTheme() ?? deviceTheme());

  useEffect(() => {
    const root = document.documentElement;
    // 두 클래스를 모두 명시해야 index.css의 prefers-color-scheme 블록이
    // "명시 선택 없음"과 "라이트를 명시로 선택"을 구분할 수 있다.
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
    root.style.colorScheme = theme;
  }, [theme]);

  // 명시적으로 고른 값만 저장한다. 기기 기본값을 저장해버리면
  // 이후 OS 테마를 바꿔도 앱이 옛 기본값에 고정된다.
  const chooseTheme = useCallback((next: Theme) => {
    rememberTheme(next);
    setTheme(next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme: chooseTheme }), [theme, chooseTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useTheme() {
  return useContext(ThemeContext);
}

export { ThemeProvider, useTheme };

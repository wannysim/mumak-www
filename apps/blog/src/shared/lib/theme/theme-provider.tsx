'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import * as React from 'react';

import { DEFAULT_THEME, THEME_STORAGE_KEY } from './theme-config';

export function ThemeProvider({ children }: React.PropsWithChildren) {
  const props = {
    attribute: 'class' as const,
    storageKey: THEME_STORAGE_KEY,
    defaultTheme: DEFAULT_THEME,
    enableSystem: true,
    disableTransitionOnChange: true,
    enableColorScheme: true,
    children,
  };

  return <NextThemesProvider {...props} />;
}

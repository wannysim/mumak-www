import { render, screen } from '@testing-library/react';

import { DEFAULT_THEME, THEME_STORAGE_KEY } from '../theme-config';
import { ThemeProvider } from '../theme-provider';

import '@testing-library/jest-dom';

// Mock next-themes
jest.mock('next-themes', () => ({
  ThemeProvider: ({
    children,
    attribute,
    defaultTheme,
    storageKey,
  }: {
    children: React.ReactNode;
    attribute: string;
    defaultTheme: string;
    storageKey: string;
    enableSystem: boolean;
    disableTransitionOnChange: boolean;
    enableColorScheme: boolean;
  }) => (
    <div
      data-testid="theme-provider"
      data-attribute={attribute}
      data-default-theme={defaultTheme}
      data-storage-key={storageKey}
    >
      {children}
    </div>
  ),
}));

describe('ThemeProvider', () => {
  it('should render children correctly', () => {
    render(
      <ThemeProvider>
        <div data-testid="child-content">Test Content</div>
      </ThemeProvider>
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should wrap children with NextThemesProvider', () => {
    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>
    );

    expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
  });

  it('should configure ThemeProvider with class attribute', () => {
    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>
    );

    const themeProvider = screen.getByTestId('theme-provider');
    expect(themeProvider).toHaveAttribute('data-attribute', 'class');
  });

  it('should use DEFAULT_THEME from theme-config', () => {
    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>
    );

    const themeProvider = screen.getByTestId('theme-provider');
    expect(themeProvider).toHaveAttribute('data-default-theme', DEFAULT_THEME);
  });

  it('should use THEME_STORAGE_KEY from theme-config', () => {
    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>
    );

    const themeProvider = screen.getByTestId('theme-provider');
    expect(themeProvider).toHaveAttribute('data-storage-key', THEME_STORAGE_KEY);
  });
});

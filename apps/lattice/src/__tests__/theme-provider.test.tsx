import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider, useTheme } from '../components/theme-provider';

function installMatchMedia(matchesDark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) =>
      ({
        matches: matchesDark && query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  });
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
    installMatchMedia(false);
  });

  afterEach(() => {
    document.documentElement.classList.remove('light', 'dark');
  });

  it('applies the default light theme to documentElement', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <div>child</div>
      </ThemeProvider>
    );

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('applies dark theme when defaultTheme is dark', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <div>child</div>
      </ThemeProvider>
    );

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('resolves system theme using prefers-color-scheme', () => {
    installMatchMedia(true);

    render(
      <ThemeProvider defaultTheme="system">
        <div>child</div>
      </ThemeProvider>
    );

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('falls back to light when system prefers light', () => {
    installMatchMedia(false);

    render(
      <ThemeProvider defaultTheme="system">
        <div>child</div>
      </ThemeProvider>
    );

    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('initializes from localStorage when key exists', () => {
    localStorage.setItem('vite-ui-theme', 'dark');

    render(
      <ThemeProvider defaultTheme="light">
        <div>child</div>
      </ThemeProvider>
    );

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('honors a custom storageKey', () => {
    localStorage.setItem('custom-key', 'dark');

    render(
      <ThemeProvider defaultTheme="light" storageKey="custom-key">
        <div>child</div>
      </ThemeProvider>
    );

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('renders children', () => {
    render(
      <ThemeProvider defaultTheme="light">
        <span>hello child</span>
      </ThemeProvider>
    );

    expect(screen.getByText('hello child')).toBeInTheDocument();
  });
});

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
    installMatchMedia(false);
  });

  it('returns the current theme from context', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider defaultTheme="dark">{children}</ThemeProvider>,
    });

    expect(result.current.theme).toBe('dark');
  });

  it('persists theme to localStorage when setTheme is called', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider defaultTheme="light">{children}</ThemeProvider>,
    });

    act(() => {
      result.current.setTheme('dark');
    });

    expect(localStorage.getItem('vite-ui-theme')).toBe('dark');
    expect(result.current.theme).toBe('dark');
  });

  it('falls back to the noop initialState when used outside a provider', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('system');
    expect(typeof result.current.setTheme).toBe('function');

    // initialState.setTheme is a noop — calling it does not throw and does not persist.
    expect(() => result.current.setTheme('dark')).not.toThrow();
    expect(localStorage.getItem('vite-ui-theme')).toBeNull();
  });
});

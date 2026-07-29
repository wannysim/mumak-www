import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider, useTheme } from '../components/theme-provider';

function installMatchMedia(prefersDark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) =>
      ({
        matches: prefersDark && query === '(prefers-color-scheme: dark)',
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

const wrapper =
  (storageKey?: string) =>
  ({ children }: { children: React.ReactNode }) => <ThemeProvider storageKey={storageKey}>{children}</ThemeProvider>;

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
    installMatchMedia(false);
  });

  afterEach(() => {
    document.documentElement.classList.remove('light', 'dark');
  });

  it('seeds from the device preference on the very first visit', () => {
    installMatchMedia(true);
    render(<ThemeProvider>{null}</ThemeProvider>);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('seeds light when the device prefers light', () => {
    render(<ThemeProvider>{null}</ThemeProvider>);
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('prefers the stored choice over the device preference', () => {
    installMatchMedia(true);
    localStorage.setItem('karaoke:theme', 'light');

    render(<ThemeProvider>{null}</ThemeProvider>);

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('ignores a stored value that is not a theme', () => {
    installMatchMedia(true);
    localStorage.setItem('karaoke:theme', 'system');

    render(<ThemeProvider>{null}</ThemeProvider>);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('honors a custom storageKey', () => {
    localStorage.setItem('custom-key', 'dark');
    render(<ThemeProvider storageKey="custom-key">{null}</ThemeProvider>);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('renders children', () => {
    render(
      <ThemeProvider>
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

  it('exposes the resolved theme', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useTheme(), { wrapper: wrapper() });
    expect(result.current.theme).toBe('dark');
  });

  it('persists the choice so later visits keep it', () => {
    const { result } = renderHook(() => useTheme(), { wrapper: wrapper() });

    act(() => result.current.setTheme('dark'));

    expect(localStorage.getItem('karaoke:theme')).toBe('dark');
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('falls back to a noop outside a provider', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('dark');
    expect(() => result.current.setTheme('light')).not.toThrow();
    expect(localStorage.getItem('karaoke:theme')).toBeNull();
  });
});

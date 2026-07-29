import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '../components/theme-provider';
import { ThemeToggle } from '../components/theme-toggle';

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

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>
  );
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('light', 'dark');
    installMatchMedia(false);
  });

  it('toggles straight between light and dark', async () => {
    renderToggle();

    const darkToggle = screen.getByRole('button', { name: '화면 어둡게' });
    expect(darkToggle).not.toHaveTextContent(/\S/);
    await userEvent.click(darkToggle);
    expect(localStorage.getItem('karaoke:theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    const lightToggle = screen.getByRole('button', { name: '화면 밝게' });
    expect(lightToggle).not.toHaveTextContent(/\S/);
    await userEvent.click(lightToggle);
    expect(localStorage.getItem('karaoke:theme')).toBe('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('starts from the device preference before the user picks', () => {
    installMatchMedia(true);
    renderToggle();

    // 기기가 다크면 다크로 시작하고, 버튼은 라이트로 넘어가는 동작을 안내한다.
    expect(screen.getByRole('button', { name: '화면 밝게' })).toBeInTheDocument();
    expect(localStorage.getItem('karaoke:theme')).toBeNull();
  });

  it('never offers a system option', async () => {
    renderToggle();
    await userEvent.click(screen.getByRole('button', { name: '화면 어둡게' }));
    await userEvent.click(screen.getByRole('button', { name: '화면 밝게' }));

    expect(localStorage.getItem('karaoke:theme')).toBe('light');
    expect(screen.queryByRole('button', { name: /시스템/ })).not.toBeInTheDocument();
  });
});

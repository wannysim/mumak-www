import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, useTheme } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';

function ThemeProbe() {
  const { theme, setTheme } = useTheme();
  return <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme}</button>;
}

function renderApp() {
  return render(
    <ThemeProvider>
      <ThemeProbe />
      <ThemeToggle />
    </ThemeProvider>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = '';
  });

  it('follows the device initially and toggles without portfolio storage', async () => {
    renderApp();

    expect(screen.getByRole('button', { name: 'light' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'light' }));

    expect(screen.getByRole('button', { name: 'dark' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '라이트 모드로 전환' })).toBeInTheDocument();
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement).not.toHaveClass('light');
    expect(document.documentElement.style.colorScheme).toBe('dark');

    await userEvent.click(screen.getByRole('button', { name: '라이트 모드로 전환' }));
    expect(screen.getByRole('button', { name: '다크 모드로 전환' })).toBeInTheDocument();
    expect(document.documentElement).not.toHaveClass('dark');
    expect(document.documentElement).toHaveClass('light');

    // 테마 선호 하나만 남고 포트폴리오 데이터는 저장하지 않는다.
    expect(Object.keys(window.localStorage)).toEqual(['mumak-quant-theme']);
  });

  it('keeps an explicitly chosen theme across a reload', async () => {
    const first = renderApp();
    await userEvent.click(screen.getByRole('button', { name: 'light' }));
    expect(screen.getByRole('button', { name: 'dark' })).toBeInTheDocument();
    first.unmount();

    renderApp();

    expect(screen.getByRole('button', { name: 'dark' })).toBeInTheDocument();
    expect(document.documentElement).toHaveClass('dark');
  });

  it('keeps following the device until a theme is chosen', () => {
    renderApp().unmount();

    expect(window.localStorage.getItem('mumak-quant-theme')).toBeNull();

    renderApp();
    expect(screen.getByRole('button', { name: 'light' })).toBeInTheDocument();
  });

  it('ignores a corrupted stored value instead of rendering an unknown theme', () => {
    window.localStorage.setItem('mumak-quant-theme', 'neon');

    renderApp();

    expect(screen.getByRole('button', { name: 'light' })).toBeInTheDocument();
  });

  it('still toggles when storage access throws', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    renderApp();
    await userEvent.click(screen.getByRole('button', { name: 'light' }));

    expect(screen.getByRole('button', { name: 'dark' })).toBeInTheDocument();
    expect(document.documentElement).toHaveClass('dark');

    setItem.mockRestore();
    getItem.mockRestore();
  });
});

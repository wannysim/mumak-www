import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, useTheme } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';

function ThemeProbe() {
  const { theme, setTheme } = useTheme();
  return <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme}</button>;
}

describe('ThemeProvider', () => {
  it('follows the device initially and toggles without portfolio storage', async () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
        <ThemeToggle />
      </ThemeProvider>
    );

    expect(screen.getByRole('button', { name: 'light' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'light' }));

    expect(screen.getByRole('button', { name: 'dark' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '라이트 모드로 전환' })).toBeInTheDocument();
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');

    await userEvent.click(screen.getByRole('button', { name: '라이트 모드로 전환' }));
    expect(screen.getByRole('button', { name: '다크 모드로 전환' })).toBeInTheDocument();
    expect(document.documentElement).not.toHaveClass('dark');
  });
});

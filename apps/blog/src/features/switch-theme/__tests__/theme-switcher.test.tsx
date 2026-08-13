import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeSwitcher } from '../ui/theme-switcher';

import '@testing-library/jest-dom';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const setTheme = jest.fn();
const mockThemeState = {
  theme: 'system',
  resolvedTheme: 'light',
  setTheme,
};

jest.mock('next-themes', () => ({
  useTheme: jest.fn(() => mockThemeState),
}));

describe('ThemeSwitcher', () => {
  beforeEach(() => {
    setTheme.mockClear();
    Object.assign(mockThemeState, { theme: 'system', resolvedTheme: 'light' as const });
  });

  it('should render trigger button', () => {
    render(<ThemeSwitcher />);

    expect(screen.getByRole('button', { name: 'changeTheme' })).toBeInTheDocument();
  });

  it('should open menu and change theme', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);

    await user.click(screen.getByRole('button', { name: 'changeTheme' }));

    expect(screen.getByRole('menuitemradio', { name: 'Light' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'System' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitemradio', { name: 'Dark' }));
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('shows dark icon when system resolves to dark', () => {
    Object.assign(mockThemeState, { theme: 'system', resolvedTheme: 'dark' as const });
    const { container } = render(<ThemeSwitcher />);

    expect(container.querySelector('.lucide-moon')).toBeInTheDocument();
  });
});

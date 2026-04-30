import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LocaleSwitcher } from '../ui/locale-switcher';

import '@testing-library/jest-dom';

// Mock next-intl
jest.mock('next-intl', () => ({
  useLocale: () => 'ko',
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      language: '언어',
    };
    return translations[key] || key;
  },
}));

const replace = jest.fn();

jest.mock('@/src/shared/config/i18n', () => ({
  usePathname: () => '/',
  useRouter: () => ({ replace }),
}));

describe('LocaleSwitcher', () => {
  beforeEach(() => {
    replace.mockClear();
  });

  it('should render trigger button', () => {
    render(<LocaleSwitcher />);

    expect(screen.getByRole('button', { name: 'Change language' })).toBeInTheDocument();
  });

  it('should render language options when opened', async () => {
    const user = userEvent.setup();
    render(<LocaleSwitcher />);

    await user.click(screen.getByRole('button', { name: 'Change language' }));

    expect(screen.getByRole('menuitemradio', { name: /한국어/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /English/ })).toBeInTheDocument();
  });

  it('should highlight current locale and call router.replace on change', async () => {
    const user = userEvent.setup();
    render(<LocaleSwitcher />);

    await user.click(screen.getByRole('button', { name: 'Change language' }));

    const koItem = screen.getByRole('menuitemradio', { name: /한국어/ });
    const enItem = screen.getByRole('menuitemradio', { name: /English/ });

    expect(koItem).toHaveAttribute('aria-checked', 'true');
    expect(enItem).toHaveAttribute('aria-checked', 'false');

    await user.click(enItem);

    expect(replace).toHaveBeenCalledWith('/', { locale: 'en' });
  });
});

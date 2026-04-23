import { render, screen } from '@testing-library/react';

import { Navigation } from '../ui/navigation';

import '@testing-library/jest-dom';

// Mock next-intl/server
jest.mock('next-intl/server', () => ({
  getTranslations: jest.fn(async () => (key: string) => {
    const translations: Record<string, string> = {
      blog: '블로그',
      essay: '에세이',
      articles: '아티클',
      notes: '노트',
    };
    return translations[key] || key;
  }),
}));

// Mock i18n routing
jest.mock('@/src/shared/config/i18n', () => ({
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// Mock child components
jest.mock('@/src/features/switch-locale', () => ({
  LocaleSwitcher: () => <div data-testid="locale-switcher">LocaleSwitcher</div>,
}));

jest.mock('@/src/features/switch-theme', () => ({
  ThemeSwitcher: () => <div data-testid="theme-switcher">ThemeSwitcher</div>,
}));

jest.mock('../ui/mobile-menu', () => ({
  MobileMenu: ({ items }: { items: { label: string; href: string }[] }) => (
    <div data-testid="mobile-menu">
      {items.map(item => (
        <span key={item.href}>{item.label}</span>
      ))}
    </div>
  ),
}));

jest.mock('../ui/nav-links', () => ({
  NavLinks: ({ items }: { items: { label: string; href: string }[] }) => (
    <div data-testid="nav-links">
      {items.map(item => (
        <span key={item.href}>{item.label}</span>
      ))}
    </div>
  ),
}));

describe('Navigation', () => {
  it('should render logo', async () => {
    const jsx = await Navigation();
    render(jsx);

    expect(screen.getByRole('link', { name: 'Wan Sim' })).toBeInTheDocument();
  });

  it('should render desktop navigation links via NavLinks', async () => {
    const jsx = await Navigation();
    render(jsx);

    const navLinks = screen.getByTestId('nav-links');
    expect(navLinks).toBeInTheDocument();
    expect(navLinks).toHaveTextContent('블로그');
  });

  it('should render mobile menu via MobileMenu', async () => {
    const jsx = await Navigation();
    render(jsx);

    const mobileMenu = screen.getByTestId('mobile-menu');
    expect(mobileMenu).toBeInTheDocument();
    expect(mobileMenu).toHaveTextContent('블로그');
  });

  it('should render theme switcher and locale switcher', async () => {
    const jsx = await Navigation();
    render(jsx);

    expect(screen.getByTestId('theme-switcher')).toBeInTheDocument();
    expect(screen.getByTestId('locale-switcher')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';

import { Navigation } from '../ui/navigation';

import '@testing-library/jest-dom';

const mockThemeSwitcher = jest.fn(() => <div data-testid="theme-switcher">ThemeSwitcher</div>);
const mockLocaleSwitcher = jest.fn(() => <div data-testid="locale-switcher">LocaleSwitcher</div>);

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
  LocaleSwitcher: () => mockLocaleSwitcher(),
}));

jest.mock('@/src/features/switch-theme', () => ({
  ThemeSwitcher: () => mockThemeSwitcher(),
}));

jest.mock('@/src/features/site-search', () => ({
  SiteSearch: ({ categoryLabels }: { categoryLabels: Record<string, string> }) => (
    <div data-testid="site-search">{Object.values(categoryLabels).join(',')}</div>
  ),
}));

jest.mock('@/src/entities/post', () => ({
  getCategories: () => ['essay', 'articles', 'notes'],
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
  beforeEach(() => {
    mockThemeSwitcher.mockImplementation(() => <div data-testid="theme-switcher">ThemeSwitcher</div>);
    mockLocaleSwitcher.mockImplementation(() => <div data-testid="locale-switcher">LocaleSwitcher</div>);
  });

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

  // 검색은 섹션별 진입점에서 헤더 전역 팔레트로 옮겨졌다. 헤더에 없으면 홈/소개/now에서
  // 검색이 다시 사라지므로 마운트 자체를 고정한다.
  it('should mount site-wide search with translated blog category labels', async () => {
    const jsx = await Navigation();
    render(jsx);

    const siteSearch = screen.getByTestId('site-search');
    expect(siteSearch).toBeInTheDocument();
    expect(siteSearch).toHaveTextContent('에세이');
    expect(siteSearch).toHaveTextContent('아티클');
  });

  it('should render theme switcher and locale switcher', async () => {
    const jsx = await Navigation();
    render(jsx);

    expect(screen.getByTestId('theme-switcher')).toBeInTheDocument();
    expect(screen.getByTestId('locale-switcher')).toBeInTheDocument();
  });

  it('keeps locale switcher available when theme switcher crashes', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockThemeSwitcher.mockImplementation(() => {
      throw new Error('theme failed');
    });

    const jsx = await Navigation();
    render(jsx);

    expect(screen.queryByTestId('theme-switcher')).not.toBeInTheDocument();
    expect(screen.getByTestId('locale-switcher')).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ClientErrorBoundary:ThemeSwitcher]',
      expect.any(Error),
      expect.any(Object)
    );

    consoleErrorSpy.mockRestore();
  });
});

import { render, screen } from '@testing-library/react';

import { Footer } from '../ui/footer';

import '@testing-library/jest-dom';

// Mock next-intl/server
jest.mock('next-intl/server', () => ({
  getTranslations: jest.fn(async () => (key: string) => {
    const translations: Record<string, string> = {
      about: 'About',
      now: 'Now',
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

describe('Footer', () => {
  it('should render RSS link', async () => {
    const jsx = await Footer();
    render(jsx);

    const rssLink = screen.getByRole('link', { name: 'RSS' });
    expect(rssLink).toBeInTheDocument();
    expect(rssLink).toHaveAttribute('href', '/feed.xml');
  });

  it('should render About link', async () => {
    const jsx = await Footer();
    render(jsx);

    const aboutLink = screen.getByRole('link', { name: 'About' });
    expect(aboutLink).toBeInTheDocument();
    expect(aboutLink).toHaveAttribute('href', '/about');
  });

  it('should render Now link', async () => {
    const jsx = await Footer();
    render(jsx);

    const nowLink = screen.getByRole('link', { name: 'Now' });
    expect(nowLink).toBeInTheDocument();
    expect(nowLink).toHaveAttribute('href', '/now');
  });

  it('should render copyright', async () => {
    const jsx = await Footer();
    render(jsx);

    expect(screen.getByText(/Wan Sim/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(new Date().getFullYear().toString()))).toBeInTheDocument();
  });
});

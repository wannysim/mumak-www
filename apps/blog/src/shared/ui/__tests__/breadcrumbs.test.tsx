import { render, screen, within } from '@testing-library/react';

import { Breadcrumbs } from '../breadcrumbs';

import '@testing-library/jest-dom';

jest.mock('@/src/shared/config/i18n', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const items = [
  { label: '홈', href: '/' },
  { label: '블로그', href: '/blog' },
  { label: '에세이', href: '/blog/essay' },
  { label: '첫 글' },
];

describe('Breadcrumbs', () => {
  it('renders a labeled breadcrumb navigation landmark', () => {
    render(<Breadcrumbs items={items} />);
    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
  });

  it('renders every ancestor as a link with its href', () => {
    render(<Breadcrumbs items={items} />);

    expect(screen.getByRole('link', { name: '홈' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: '블로그' })).toHaveAttribute('href', '/blog');
    expect(screen.getByRole('link', { name: '에세이' })).toHaveAttribute('href', '/blog/essay');
  });

  it('renders the last item as the current page, not a navigable link', () => {
    render(<Breadcrumbs items={items} />);

    // shadcn BreadcrumbPage는 role="link" + aria-disabled로 노출되므로,
    // "탐색 불가(href 없음) + aria-current"로 현재 페이지임을 검증한다.
    const current = screen.getByText('첫 글');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveAttribute('data-slot', 'breadcrumb-page');
    expect(current).not.toHaveAttribute('href');
    expect(current.tagName).toBe('SPAN');
  });

  it('renders one separator fewer than the number of crumbs', () => {
    const { container } = render(<Breadcrumbs items={items} />);
    const separators = container.querySelectorAll('[data-slot="breadcrumb-separator"]');
    expect(separators).toHaveLength(items.length - 1);
  });

  it('supports a short garden-style trail (home / garden / note)', () => {
    render(
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Garden', href: '/garden' }, { label: 'A note' }]} />
    );

    const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(within(nav).getByRole('link', { name: 'Garden' })).toHaveAttribute('href', '/garden');

    const current = within(nav).getByText('A note');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).not.toHaveAttribute('href');
  });
});

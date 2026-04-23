import { render, screen } from '@testing-library/react';

import type { Category } from '@/src/entities/post';

import { BlogNav } from '../ui/blog-nav';

import '@testing-library/jest-dom';

const mockUsePathname = jest.fn(() => '/blog');

jest.mock('@/src/shared/config/i18n', () => ({
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  usePathname: () => mockUsePathname(),
}));

const categoryLabels: Record<Category, string> = {
  essay: '에세이',
  articles: '아티클',
  notes: '노트',
};

const renderNav = (props: Partial<Parameters<typeof BlogNav>[0]> = {}) =>
  render(<BlogNav allLabel="전체" categoryLabels={categoryLabels} tagsLabel="태그" {...props} />);

const ACTIVE_CLASS_FRAGMENT = 'bg-background';
const INACTIVE_CLASS_FRAGMENT = 'dark:text-muted-foreground';

describe('BlogNav', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/blog');
  });

  it('renders the all/category/tags links', () => {
    renderNav();

    expect(screen.getByRole('link', { name: '전체' })).toHaveAttribute('href', '/blog');
    expect(screen.getByRole('link', { name: '에세이' })).toHaveAttribute('href', '/blog/essay');
    expect(screen.getByRole('link', { name: '아티클' })).toHaveAttribute('href', '/blog/articles');
    expect(screen.getByRole('link', { name: '노트' })).toHaveAttribute('href', '/blog/notes');
    expect(screen.getByRole('link', { name: /태그/ })).toHaveAttribute('href', '/blog/tags');
  });

  it('marks "all" link active on /blog', () => {
    mockUsePathname.mockReturnValue('/blog');

    renderNav();

    expect(screen.getByRole('link', { name: '전체' })).toHaveClass(ACTIVE_CLASS_FRAGMENT);
    expect(screen.getByRole('link', { name: '에세이' })).toHaveClass(INACTIVE_CLASS_FRAGMENT);
  });

  it.each([
    ['essay', '에세이', '/blog/essay'],
    ['articles', '아티클', '/blog/articles'],
    ['notes', '노트', '/blog/notes'],
  ] as const)('marks %s active when pathname is %s', (_cat, label, pathname) => {
    mockUsePathname.mockReturnValue(pathname);

    renderNav();

    expect(screen.getByRole('link', { name: label })).toHaveClass(ACTIVE_CLASS_FRAGMENT);
    expect(screen.getByRole('link', { name: '전체' })).not.toHaveClass(ACTIVE_CLASS_FRAGMENT);
  });

  it('marks tags link active for /blog/tags and nested paths', () => {
    mockUsePathname.mockReturnValue('/blog/tags/react');

    renderNav();

    expect(screen.getByRole('link', { name: /태그/ })).toHaveClass(ACTIVE_CLASS_FRAGMENT);
    expect(screen.getByRole('link', { name: '전체' })).not.toHaveClass(ACTIVE_CLASS_FRAGMENT);
  });

  it('renders without tagsLabel', () => {
    renderNav({ tagsLabel: undefined });

    expect(screen.getByRole('link', { name: '전체' })).toBeInTheDocument();
  });
});

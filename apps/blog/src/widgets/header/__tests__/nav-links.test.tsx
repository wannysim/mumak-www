import { render, screen } from '@testing-library/react';

import { NavLinks } from '../ui/nav-links';

import '@testing-library/jest-dom';

const mockUsePathname = jest.fn(() => '/');

jest.mock('@/src/shared/config/i18n', () => ({
  Link: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a>,
  usePathname: () => mockUsePathname(),
}));

const items = [
  { href: '/', label: 'Home' },
  { href: '/blog', label: 'Blog' },
];

describe('NavLinks', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/');
  });

  it('should render links with correct labels', () => {
    render(<NavLinks items={items} />);

    expect(screen.getByText('Blog')).toBeInTheDocument();
  });

  it('should apply active styles when pathname matches', () => {
    mockUsePathname.mockReturnValue('/blog');

    render(<NavLinks items={items} />);

    const blogLink = screen.getByText('Blog').closest('a');
    expect(blogLink).toHaveClass('bg-muted font-medium');
    expect(blogLink).not.toHaveClass('hover:bg-muted/50');
  });

  it('should apply inactive styles when pathname does not match', () => {
    mockUsePathname.mockReturnValue('/');

    render(<NavLinks items={items} />);

    const blogLink = screen.getByText('Blog').closest('a');
    expect(blogLink).toHaveClass('hover:bg-muted/50');
    expect(blogLink).not.toHaveClass('bg-muted font-medium');
  });
});

it.each(['/blog', '/blog/essay/post'])('Home is not active at %s', pathname => {
  mockUsePathname.mockReturnValue(pathname);
  render(<NavLinks items={items} />);
  expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  expect(screen.getByRole('link', { name: 'Blog' })).toHaveAttribute('aria-current', 'page');
});
it('Home is active only at the root', () => {
  mockUsePathname.mockReturnValue('/');
  render(<NavLinks items={items} />);
  expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'Blog' })).not.toHaveAttribute('aria-current');
});

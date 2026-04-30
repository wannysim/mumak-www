import { render, screen } from '@testing-library/react';

import { MobileMenu } from '../ui/mobile-menu';

import '@testing-library/jest-dom';

const mockUsePathname = jest.fn(() => '/');

jest.mock('@/src/shared/config/i18n', () => ({
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  usePathname: () => mockUsePathname(),
}));

// Mock Sheet components
jest.mock('@mumak/ui/components/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet">{children}</div>,
  SheetTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet-trigger">{children}</div>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet-content">{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetClose: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const items = [{ href: '/blog', label: 'Blog' }];

describe('MobileMenu', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/');
  });

  it('should render trigger button', () => {
    render(<MobileMenu items={items} />);
    expect(screen.getByRole('button', { name: 'Open navigation' })).toBeInTheDocument();
  });

  it('should render links in sheet content', () => {
    render(<MobileMenu items={items} />);

    expect(screen.getByText('Blog')).toBeInTheDocument();
  });

  it('should apply active styles when pathname matches', () => {
    mockUsePathname.mockReturnValue('/blog');

    render(<MobileMenu items={items} />);

    const blogLink = screen.getByText('Blog').closest('a');
    expect(blogLink).toHaveClass('text-foreground');
    expect(blogLink).not.toHaveClass('text-muted-foreground');
  });

  it('should apply inactive styles when pathname does not match', () => {
    mockUsePathname.mockReturnValue('/');

    render(<MobileMenu items={items} />);

    const blogLink = screen.getByText('Blog').closest('a');
    expect(blogLink).toHaveClass('text-muted-foreground');
    expect(blogLink).not.toHaveClass('text-foreground');
  });
});

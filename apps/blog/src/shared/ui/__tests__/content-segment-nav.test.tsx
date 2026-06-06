import { render, screen } from '@testing-library/react';

import { ContentSegmentNav, type ContentSegmentNavItem } from '../content-segment-nav';

import '@testing-library/jest-dom';

jest.mock('@/src/shared/config/i18n', () => ({
  Link: ({
    children,
    href,
    className,
    'aria-current': ariaCurrent,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
    'aria-current'?: React.AriaAttributes['aria-current'];
  }) => (
    <a href={href} className={className} aria-current={ariaCurrent}>
      {children}
    </a>
  ),
}));

const items: ContentSegmentNavItem[] = [
  { key: 'all', href: '/blog', label: 'All', active: true },
  { key: 'essay', href: '/blog/essay', label: 'Essay', active: false },
  { key: 'tags', href: '/blog/tags', label: 'Tags', active: false, icon: <span>#</span>, dividerBefore: true },
];

describe('ContentSegmentNav', () => {
  it('renders a labelled segment nav with the content-segment-nav slot', () => {
    render(<ContentSegmentNav items={items} aria-label="Blog sections" />);

    const nav = screen.getByRole('navigation', { name: 'Blog sections' });
    expect(nav).toHaveAttribute('data-slot', 'content-segment-nav');
  });

  it('renders one link per item with its href', () => {
    render(<ContentSegmentNav items={items} />);

    expect(screen.getByRole('link', { name: 'All' })).toHaveAttribute('href', '/blog');
    expect(screen.getByRole('link', { name: 'Essay' })).toHaveAttribute('href', '/blog/essay');
    expect(screen.getByRole('link', { name: /Tags/ })).toHaveAttribute('href', '/blog/tags');
  });

  it('marks only the active item with aria-current="page"', () => {
    render(<ContentSegmentNav items={items} />);

    expect(screen.getByRole('link', { name: 'All' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Essay' })).not.toHaveAttribute('aria-current');
  });

  it('renders a divider before items flagged with dividerBefore', () => {
    const { container } = render(<ContentSegmentNav items={items} />);

    expect(container.querySelectorAll('.w-px')).toHaveLength(1);
  });

  describe('counts', () => {
    const withCounts: ContentSegmentNavItem[] = [
      { key: 'all', href: '/blog', label: 'All', active: true, count: 12 },
      { key: 'essay', href: '/blog/essay', label: 'Essay', active: false, count: 5 },
      { key: 'none', href: '/blog/none', label: 'None', active: false },
    ];

    it('renders the count next to the label when provided', () => {
      render(<ContentSegmentNav items={withCounts} />);

      expect(screen.getByRole('link', { name: 'All 12' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Essay 5' })).toBeInTheDocument();
    });

    it('omits the count element when count is not provided', () => {
      render(<ContentSegmentNav items={withCounts} />);

      const none = screen.getByRole('link', { name: 'None' });
      expect(none.querySelector('[data-slot="content-segment-nav-count"]')).toBeNull();
    });

    it('still renders a zero count rather than hiding it', () => {
      render(<ContentSegmentNav items={[{ key: 'z', href: '/z', label: 'Zero', active: false, count: 0 }]} />);

      expect(screen.getByRole('link', { name: 'Zero 0' })).toBeInTheDocument();
    });
  });
});

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

  it('uses a wrapping mobile layout without changing the desktop segmented layout', () => {
    const { container } = render(<ContentSegmentNav items={items} />);

    const nav = container.querySelector('[data-slot="content-segment-nav"]');
    expect(nav).toHaveClass('w-full', 'max-w-full', 'flex-wrap', 'sm:w-fit', 'sm:flex-nowrap');
    expect(container.querySelector('.w-px')).toHaveClass('hidden', 'sm:block');
  });

  it('renders one link per item with its href', () => {
    render(<ContentSegmentNav items={items} />);

    expect(screen.getByRole('link', { name: 'All' })).toHaveAttribute('href', '/blog');
    expect(screen.getByRole('link', { name: 'Essay' })).toHaveAttribute('href', '/blog/essay');
    expect(screen.getByRole('link', { name: /Tags/ })).toHaveAttribute('href', '/blog/tags');
  });

  it('constrains item labels and counts so long content cannot widen the page', () => {
    render(
      <ContentSegmentNav
        items={[{ key: 'long', href: '/long', label: 'Very long segment label', active: true, count: 123 }]}
      />
    );

    expect(screen.getByRole('link', { name: 'Very long segment label 123' })).toHaveClass(
      'max-w-full',
      'min-w-0',
      'overflow-hidden'
    );
    expect(screen.getByText('Very long segment label')).toHaveClass('min-w-0', 'truncate');
    expect(screen.getByText('123')).toHaveClass('shrink-0');
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

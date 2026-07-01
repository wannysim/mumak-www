import { render, screen } from '@testing-library/react';

import { ContentCard } from '../content-card';

import '@testing-library/jest-dom';

jest.mock('@/src/shared/config/i18n', () => ({
  Link: ({ children, href, className, ...props }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

describe('ContentCard', () => {
  it('renders title and meta inside a content-card slot, with the title as the card link', () => {
    const { container } = render(<ContentCard href="/blog/x" title="Hello" meta={<span>meta</span>} />);

    // stretched-link 패턴: 카드 링크는 제목 하나뿐이고 href를 가진다.
    const link = screen.getByRole('link', { name: 'Hello' });
    expect(link).toHaveAttribute('href', '/blog/x');
    expect(link).toHaveAttribute('data-slot', 'content-card-link');
    expect(screen.getByRole('heading', { level: 3 })).toContainElement(link);
    expect(container.querySelector('[data-slot="content-card"]')).toBeInTheDocument();
    expect(screen.getByText('meta')).toBeInTheDocument();
  });

  it('keeps the card link and slot content as siblings (no interactive nested in the card link)', () => {
    render(<ContentCard href="/x" title="T" meta={null} tags={<span data-testid="tag-slot">#a</span>} />);

    // 태그 슬롯이 카드 표면 링크(제목) 밖에 있어야 anchor-in-anchor(nested-interactive)를 피한다.
    const cardLink = screen.getByRole('link', { name: 'T' });
    const tagSlot = screen.getByTestId('tag-slot');
    expect(cardLink).not.toContainElement(tagSlot);
  });

  it('omits description, tags, and footer when not provided', () => {
    const { container } = render(<ContentCard href="/x" title="T" meta={null} />);

    expect(container.querySelector('p')).not.toBeInTheDocument();
    expect(screen.queryByText('tags')).not.toBeInTheDocument();
    expect(screen.queryByText('footer')).not.toBeInTheDocument();
  });

  it('renders description, tags, and footer slots when provided', () => {
    render(
      <ContentCard
        href="/x"
        title="T"
        meta={null}
        description="desc"
        tags={<span>tags</span>}
        footer={<span>footer</span>}
      />
    );

    expect(screen.getByText('desc')).toBeInTheDocument();
    expect(screen.getByText('tags')).toBeInTheDocument();
    expect(screen.getByText('footer')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';

import { ContentCard } from '../content-card';

import '@testing-library/jest-dom';

jest.mock('@/src/shared/config/i18n', () => ({
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe('ContentCard', () => {
  it('renders title and meta inside a content-card slot linked to href', () => {
    const { container } = render(<ContentCard href="/blog/x" title="Hello" meta={<span>meta</span>} />);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/blog/x');
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Hello');
    expect(container.querySelector('[data-slot="content-card"]')).toBeInTheDocument();
    expect(screen.getByText('meta')).toBeInTheDocument();
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

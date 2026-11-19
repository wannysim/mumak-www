import { render, screen } from '@testing-library/react';

import { TagCloud } from '../ui/tag-cloud';

// Mock next-intl Link
vi.mock('@/src/shared/config/i18n', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const mockTags = [
  { name: 'thought', count: 3, slug: 'thought' },
  { name: 'code', count: 2, slug: 'code' },
  { name: 'ai', count: 1, slug: 'ai' },
];

describe('TagCloud', () => {
  it('renders all tags', () => {
    render(<TagCloud tags={mockTags} />);

    expect(screen.getByText('thought')).toBeInTheDocument();
    expect(screen.getByText('code')).toBeInTheDocument();
    expect(screen.getByText('ai')).toBeInTheDocument();
  });

  it('displays tag count when showCount is true', () => {
    render(<TagCloud tags={mockTags} showCount />);

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('hides tag count when showCount is false', () => {
    render(<TagCloud tags={mockTags} showCount={false} />);

    expect(screen.queryByText('3')).not.toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('shows count by default', () => {
    render(<TagCloud tags={mockTags} />);

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders tags as links to tag pages', () => {
    render(<TagCloud tags={mockTags} />);

    const thoughtLink = screen.getByRole('link', { name: /thought/ });
    expect(thoughtLink).toHaveAttribute('href', '/blog/tags/thought');

    const codeLink = screen.getByRole('link', { name: /code/ });
    expect(codeLink).toHaveAttribute('href', '/blog/tags/code');
  });

  it('renders empty div when tags array is empty', () => {
    const { container } = render(<TagCloud tags={[]} />);

    const tagContainer = container.querySelector('div');
    expect(tagContainer).toBeInTheDocument();
    expect(tagContainer?.children).toHaveLength(0);
  });

  it('handles URL-encoded slugs', () => {
    const tagsWithSpecialChars = [{ name: 'c++', count: 1, slug: encodeURIComponent('c++') }];

    render(<TagCloud tags={tagsWithSpecialChars} />);

    const link = screen.getByRole('link', { name: /c\+\+/ });
    expect(link).toHaveAttribute('href', `/blog/tags/${encodeURIComponent('c++')}`);
  });

  it('uses custom basePath for links', () => {
    render(<TagCloud tags={mockTags} basePath="/garden/tags" />);

    const thoughtLink = screen.getByRole('link', { name: /thought/ });
    expect(thoughtLink).toHaveAttribute('href', '/garden/tags/thought');

    const codeLink = screen.getByRole('link', { name: /code/ });
    expect(codeLink).toHaveAttribute('href', '/garden/tags/code');
  });

  it('defaults to /blog/tags when basePath is not provided', () => {
    render(<TagCloud tags={mockTags} />);

    const link = screen.getByRole('link', { name: /thought/ });
    expect(link).toHaveAttribute('href', '/blog/tags/thought');
  });
});

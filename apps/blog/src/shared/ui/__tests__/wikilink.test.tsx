import { render, screen } from '@testing-library/react';

import { BrokenWikiEmbed, BrokenWikiLink, WikiEmbed, WikiLink } from '../wikilink';

import '@testing-library/jest-dom';

jest.mock('@/src/shared/config/i18n', () => ({
  Link: ({
    children,
    href,
    className,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
    [key: string]: unknown;
  }) => (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  ),
}));

describe('WikiLink', () => {
  it('renders a link to the resolved note href with slug data attribute', () => {
    render(
      <WikiLink href="/garden/note-a" slug="note-a">
        Note A
      </WikiLink>
    );

    const link = screen.getByRole('link', { name: 'Note A' });
    expect(link).toHaveAttribute('href', '/garden/note-a');
    expect(link).toHaveAttribute('data-wikilink');
    expect(link).toHaveAttribute('data-slug', 'note-a');
  });

  it('merges custom className with base styles', () => {
    render(
      <WikiLink href="/garden/x" slug="x" className="custom-class">
        X
      </WikiLink>
    );

    const link = screen.getByRole('link', { name: 'X' });
    expect(link).toHaveClass('custom-class');
    expect(link).toHaveClass('text-primary');
  });
});

describe('BrokenWikiLink', () => {
  it('renders a span with broken markers and slug-aware title', () => {
    render(<BrokenWikiLink slug="missing-note">missing-note</BrokenWikiLink>);

    const span = screen.getByText('missing-note');
    expect(span.tagName).toBe('SPAN');
    expect(span).toHaveAttribute('data-wikilink-broken');
    expect(span).toHaveAttribute('data-slug', 'missing-note');
    expect(span).toHaveAttribute('title', expect.stringContaining('missing-note'));
  });

  it('does not render as a link', () => {
    render(<BrokenWikiLink slug="x">label</BrokenWikiLink>);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('WikiEmbed', () => {
  it('renders title as link and excerpt below', () => {
    render(<WikiEmbed href="/garden/topic" slug="topic" title="Topic Heading" excerpt="Brief overview." />);

    const link = screen.getByRole('link', { name: 'Topic Heading' });
    expect(link).toHaveAttribute('href', '/garden/topic');
    expect(link).toHaveAttribute('data-wiki-embed-link');
    expect(link).toHaveAttribute('data-slug', 'topic');
    expect(screen.getByText('Brief overview.')).toBeInTheDocument();
  });

  it('wraps content in an aside marked as wiki embed', () => {
    const { container } = render(<WikiEmbed href="/garden/topic" slug="topic" title="Title" excerpt="Excerpt" />);

    const aside = container.querySelector('aside[data-wiki-embed]');
    expect(aside).not.toBeNull();
  });
});

describe('BrokenWikiEmbed', () => {
  it('renders broken embed marker and the missing slug', () => {
    const { container } = render(<BrokenWikiEmbed slug="not-found" />);

    const aside = container.querySelector('aside[data-wiki-embed-broken]');
    expect(aside).not.toBeNull();
    expect(aside).toHaveAttribute('data-slug', 'not-found');
    expect(aside?.textContent).toContain('not-found');
  });
});

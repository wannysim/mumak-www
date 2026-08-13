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
    // 본문 MDX 링크·연결된 노트와 같은 토큰. text-primary는 라이트에서 AA 미달이다.
    expect(link).toHaveClass('text-accent-foreground');
  });
});

describe('BrokenWikiLink', () => {
  it('renders a span with broken markers and no duplicate title tooltip', () => {
    render(
      <BrokenWikiLink slug="missing-note" notice="NOTICE">
        missing-note
      </BrokenWikiLink>
    );

    const span = screen.getByText('missing-note');
    expect(span.tagName).toBe('SPAN');
    expect(span).toHaveAttribute('data-wikilink-broken');
    expect(span).toHaveAttribute('data-slug', 'missing-note');
    // title은 sr-only 문구와 같은 문장이라 NVDA 기본 설정에서 두 번 낭독된다. 하나만 남긴다.
    expect(span).not.toHaveAttribute('title');
  });

  it('announces the broken state to screen readers, not only via strikethrough', () => {
    render(
      <BrokenWikiLink slug="missing-note" notice="NOTICE">
        missing-note
      </BrokenWikiLink>
    );

    expect(screen.getByText('(NOTICE)', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('missing-note').textContent).toContain('NOTICE');
  });

  it('does not render as a link', () => {
    render(
      <BrokenWikiLink slug="x" notice="NOTICE">
        label
      </BrokenWikiLink>
    );

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
  it('renders broken embed marker and the reader-facing notice', () => {
    const { container } = render(<BrokenWikiEmbed slug="not-found" notice="No preview for not-found" />);

    const aside = container.querySelector('aside[data-wiki-embed-broken]');
    expect(aside).not.toBeNull();
    expect(aside).toHaveAttribute('data-slug', 'not-found');
    expect(aside?.textContent).toContain('No preview for not-found');
  });

  it('does not strike through the notice — it is a status sentence, not deleted text', () => {
    render(<BrokenWikiEmbed slug="not-found" notice="No preview for not-found" />);

    expect(screen.getByText('No preview for not-found')).not.toHaveClass('line-through');
  });
});

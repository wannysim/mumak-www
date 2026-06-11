import { render, screen } from '@testing-library/react';
import * as React from 'react';

import { mdxComponents } from '../mdx-components';

import '@testing-library/jest-dom';

jest.mock('@/src/shared/config/i18n', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <a data-i18n-link {...props}>
      {children}
    </a>
  ),
}));

const Anchor = mdxComponents.a as React.FC<{
  href?: string;
  children?: React.ReactNode;
}>;

describe('mdxComponents.a', () => {
  it('opens external links in a new tab with a safe rel', () => {
    render(<Anchor href="https://example.com">external</Anchor>);

    const link = screen.getByRole('link', { name: 'external' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).not.toHaveAttribute('data-i18n-link');
  });

  it('renders in-app links through the locale-aware Link without a new tab', () => {
    render(<Anchor href="/blog/foo">internal</Anchor>);

    const link = screen.getByRole('link', { name: 'internal' });
    expect(link).toHaveAttribute('data-i18n-link');
    expect(link).not.toHaveAttribute('target');
  });

  it('strips an existing locale prefix before rendering in-app links through the locale-aware Link', () => {
    render(<Anchor href="/ko/blog/articles/react-compiler-rust-port">locale-prefixed internal</Anchor>);

    const link = screen.getByRole('link', { name: 'locale-prefixed internal' });
    expect(link).toHaveAttribute('data-i18n-link');
    expect(link).toHaveAttribute('href', '/blog/articles/react-compiler-rust-port');
    expect(link).not.toHaveAttribute('target');
  });

  it('maps Obsidian vault-root content links to in-app routes', () => {
    render(<Anchor href="/ko/articles/react-compiler-rust-port.mdx">content file internal</Anchor>);

    const link = screen.getByRole('link', { name: 'content file internal' });
    expect(link).toHaveAttribute('data-i18n-link');
    expect(link).toHaveAttribute('href', '/blog/articles/react-compiler-rust-port');
    expect(link).not.toHaveAttribute('target');
  });

  it('renders mailto links as a plain anchor without new-tab behavior', () => {
    render(<Anchor href="mailto:a@b.com">mail</Anchor>);

    const link = screen.getByRole('link', { name: 'mail' });
    expect(link).toHaveAttribute('href', 'mailto:a@b.com');
    expect(link).not.toHaveAttribute('target');
    expect(link).not.toHaveAttribute('data-i18n-link');
  });
});

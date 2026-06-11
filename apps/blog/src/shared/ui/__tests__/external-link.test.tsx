import { render, screen } from '@testing-library/react';

import { ExternalLink } from '../external-link';

import '@testing-library/jest-dom';

describe('ExternalLink', () => {
  it('always opens in a new tab with a safe rel and the external-link slot', () => {
    render(<ExternalLink href="https://example.com">site</ExternalLink>);

    const link = screen.getByRole('link', { name: 'site' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('data-slot', 'external-link');
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('forwards className and other anchor props', () => {
    render(
      <ExternalLink href="https://example.com" className="custom-class" aria-label="Open site">
        site
      </ExternalLink>
    );

    expect(screen.getByRole('link', { name: 'Open site' })).toHaveClass('custom-class');
  });
});

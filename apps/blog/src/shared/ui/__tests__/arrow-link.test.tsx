import { render, screen } from '@testing-library/react';

import { ArrowLink } from '../arrow-link';

import '@testing-library/jest-dom';

jest.mock('@/src/shared/config/i18n', () => ({
  Link: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <a {...props}>{children}</a>,
}));

describe('ArrowLink', () => {
  it('renders a link to the given href with the arrow-link slot', () => {
    render(<ArrowLink href="/about">About</ArrowLink>);

    const link = screen.getByRole('link', { name: 'About' });
    expect(link).toHaveAttribute('href', '/about');
    expect(link).toHaveAttribute('data-slot', 'arrow-link');
  });

  it('renders a decorative arrow icon hidden from the a11y tree', () => {
    const { container } = render(<ArrowLink href="/now">Now</ArrowLink>);

    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('link')).toHaveAccessibleName('Now');
  });

  it('merges a custom className with the base styles', () => {
    render(
      <ArrowLink href="/about" className="custom-class">
        About
      </ArrowLink>
    );

    expect(screen.getByRole('link', { name: 'About' })).toHaveClass('custom-class');
  });
});

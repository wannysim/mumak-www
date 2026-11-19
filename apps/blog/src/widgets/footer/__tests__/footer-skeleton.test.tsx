import { render } from '@testing-library/react';

import { FooterSkeleton } from '../ui/footer-skeleton';

describe('FooterSkeleton', () => {
  it('renders footer element with border', () => {
    const { container } = render(<FooterSkeleton />);

    const footer = container.querySelector('footer');
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveClass('border-t');
  });

  it('renders skeleton placeholders', () => {
    const { container } = render(<FooterSkeleton />);

    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });
});

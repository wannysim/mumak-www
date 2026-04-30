import { render, screen } from '@testing-library/react';

import { NavigationSkeleton } from '../ui/navigation-skeleton';

import '@testing-library/jest-dom';

describe('NavigationSkeleton', () => {
  it('renders nav element', () => {
    render(<NavigationSkeleton />);

    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('renders skeleton placeholders for nav layout', () => {
    const { container } = render(<NavigationSkeleton />);

    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThanOrEqual(5);
  });
});

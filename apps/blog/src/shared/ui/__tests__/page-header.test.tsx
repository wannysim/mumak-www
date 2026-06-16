import { render, screen } from '@testing-library/react';

import { PageHeader } from '../page-header';

import '@testing-library/jest-dom';

describe('PageHeader', () => {
  it('renders a page heading', () => {
    const { container } = render(<PageHeader title="Garden" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Garden' })).toBeInTheDocument();
    expect(container.querySelector('[data-slot="page-header"]')).toBeInTheDocument();
  });

  it('omits the description paragraph when description is not provided', () => {
    const { container } = render(<PageHeader title="Garden" />);

    expect(container.querySelector('p')).not.toBeInTheDocument();
  });

  it('renders the description when provided', () => {
    render(<PageHeader title="Garden" description="Notes that grow over time" />);

    expect(screen.getByText('Notes that grow over time')).toBeInTheDocument();
  });
});

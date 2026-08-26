import { render, screen } from '@testing-library/react';

import type { ParaCategoryKey } from '@/src/entities/note';

import { GardenOverview } from '../ui/garden-overview';

import '@testing-library/jest-dom';

jest.mock('@/src/shared/config/i18n', () => ({
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

jest.mock('@/src/shared/ui', () => ({ cardSurfaceClass: 'card-surface' }));

jest.mock('@mumak/ui/components/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

const items: { key: ParaCategoryKey; label: string; description: string; count: number }[] = [
  { key: 'projects', label: 'Projects', description: 'Active work with deadlines', count: 3 },
  { key: 'areas', label: 'Areas', description: 'Ongoing responsibilities', count: 5 },
];

describe('GardenOverview', () => {
  it('renders a tile per item with label, description and count', () => {
    render(<GardenOverview items={items} />);

    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Active work with deadlines')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('links each category to its /garden/category/[key] route', () => {
    render(<GardenOverview items={items} />);

    expect(screen.getByRole('link', { name: /Projects/ })).toHaveAttribute('href', '/garden/category/projects');
    expect(screen.getByRole('link', { name: /Areas/ })).toHaveAttribute('href', '/garden/category/areas');
  });

  it('keeps category title hover colors readable as normal-sized text', () => {
    render(<GardenOverview items={items} />);

    const title = screen.getByText('Projects');
    expect(title).toHaveClass('group-hover:text-accent-foreground');
    expect(title).not.toHaveClass('group-hover:text-primary');
  });

  it('renders nothing when there are no items', () => {
    const { container } = render(<GardenOverview items={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});

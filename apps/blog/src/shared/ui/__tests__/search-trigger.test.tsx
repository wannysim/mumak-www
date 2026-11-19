import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SearchTrigger } from '../search-trigger';

describe('SearchTrigger', () => {
  it('renders the placeholder text', () => {
    render(<SearchTrigger onClick={vi.fn()} placeholder="Search posts…" />);

    expect(screen.getByText('Search posts…')).toBeInTheDocument();
  });

  it('shows the ⌘K shortcut hint by default', () => {
    render(<SearchTrigger onClick={vi.fn()} placeholder="Search" />);

    expect(screen.getByText('⌘')).toBeInTheDocument();
    expect(screen.getByText('K')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).toHaveAttribute('aria-keyshortcuts', 'Meta+K Control+K');
  });

  it('hides the shortcut hint when showShortcut is false', () => {
    render(<SearchTrigger onClick={vi.fn()} placeholder="Search" showShortcut={false} />);

    expect(screen.queryByText('⌘')).not.toBeInTheDocument();
    expect(screen.queryByText('K')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search' })).not.toHaveAttribute('aria-keyshortcuts');
  });

  it('fires onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<SearchTrigger onClick={onClick} placeholder="Search" />);

    await user.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('uses the provided ariaLabel when set', () => {
    render(<SearchTrigger onClick={vi.fn()} placeholder="Search" ariaLabel="Open search" />);

    expect(screen.getByRole('button', { name: 'Open search' })).toBeInTheDocument();
  });
});

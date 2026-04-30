import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SearchTrigger } from '../search-trigger';

import '@testing-library/jest-dom';

describe('SearchTrigger', () => {
  it('renders the placeholder text', () => {
    render(<SearchTrigger onClick={jest.fn()} placeholder="Search posts…" />);

    expect(screen.getByText('Search posts…')).toBeInTheDocument();
  });

  it('shows the ⌘K shortcut hint by default', () => {
    render(<SearchTrigger onClick={jest.fn()} placeholder="Search" />);

    expect(screen.getByText('⌘')).toBeInTheDocument();
    expect(screen.getByText('K')).toBeInTheDocument();
  });

  it('hides the shortcut hint when showShortcut is false', () => {
    render(<SearchTrigger onClick={jest.fn()} placeholder="Search" showShortcut={false} />);

    expect(screen.queryByText('⌘')).not.toBeInTheDocument();
    expect(screen.queryByText('K')).not.toBeInTheDocument();
  });

  it('fires onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<SearchTrigger onClick={onClick} placeholder="Search" />);

    await user.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('uses the provided ariaLabel when set', () => {
    render(<SearchTrigger onClick={jest.fn()} placeholder="Search" ariaLabel="Open search" />);

    expect(screen.getByRole('button', { name: 'Open search' })).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Counter } from '../components/counter';

describe('Counter', () => {
  it('renders with initial count of 0', () => {
    render(<Counter />);
    expect(screen.getByText('Count: 0')).toBeInTheDocument();
  });

  it('increments count when + button is clicked', async () => {
    const user = userEvent.setup();
    render(<Counter />);

    const incrementButton = screen.getByRole('button', { name: '+' });
    await user.click(incrementButton);

    expect(screen.getByText('Count: 1')).toBeInTheDocument();
  });

  it('decrements count when - button is clicked', async () => {
    const user = userEvent.setup();
    render(<Counter />);

    const decrementButton = screen.getByRole('button', { name: '-' });
    await user.click(decrementButton);

    expect(screen.getByText('Count: -1')).toBeInTheDocument();
  });

  it('can increment and decrement multiple times', async () => {
    const user = userEvent.setup();
    render(<Counter />);

    const incrementButton = screen.getByRole('button', { name: '+' });
    const decrementButton = screen.getByRole('button', { name: '-' });

    // Increment twice
    await user.click(incrementButton);
    await user.click(incrementButton);
    expect(screen.getByText('Count: 2')).toBeInTheDocument();

    // Decrement once
    await user.click(decrementButton);
    expect(screen.getByText('Count: 1')).toBeInTheDocument();
  });
});

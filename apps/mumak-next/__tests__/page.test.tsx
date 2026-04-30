import { fireEvent, render, screen } from '@testing-library/react';

import Page from '../app/page';

import '@testing-library/jest-dom';

// Mock the UI components
jest.mock('@mumak/ui/components/button', () => ({
  Button: ({ children, onClick, ...props }: React.ComponentProps<'button'>) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

describe('Page Component', () => {
  it('renders the page title', () => {
    render(<Page />);
    expect(screen.getByText('Mumak Next')).toBeInTheDocument();
  });

  it('renders initial count as 0', () => {
    render(<Page />);
    expect(screen.getByText('Count: 0')).toBeInTheDocument();
  });

  it('increments count when + button is clicked', () => {
    render(<Page />);
    const incrementButton = screen.getByText('+');

    fireEvent.click(incrementButton);
    expect(screen.getByText('Count: 1')).toBeInTheDocument();
  });

  it('decrements count when - button is clicked', () => {
    render(<Page />);
    const decrementButton = screen.getByText('-');

    fireEvent.click(decrementButton);
    expect(screen.getByText('Count: -1')).toBeInTheDocument();
  });

  it('renders both buttons', () => {
    render(<Page />);
    expect(screen.getByText('+')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
  });
});

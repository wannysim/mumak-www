import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import App from '../app';

describe('App', () => {
  it('renders the app heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Mumak React', level: 1 })).toBeInTheDocument();
  });

  it('renders the Counter component', () => {
    render(<App />);
    expect(screen.getByText('Count: 0')).toBeInTheDocument();
  });
});

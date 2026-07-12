import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import App from '../app';

describe('App', () => {
  it('renders the lattice heading', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Lattice', level: 1 })).toBeInTheDocument();
    // jsdom에는 카메라가 없으므로 폴백 안내로 정착해야 한다
    expect(await screen.findByText(/camera offline/)).toBeInTheDocument();
  });

  it('renders a chip for every filter and all video layers', async () => {
    render(<App />);
    expect(screen.getAllByRole('button')).toHaveLength(7);
    expect(screen.getByLabelText('bunny layer')).toBeInTheDocument();
    await screen.findByText(/camera offline/);
  });
});

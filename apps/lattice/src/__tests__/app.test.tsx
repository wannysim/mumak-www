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

  it('renders filter chips, video layers, and initial filter panes', async () => {
    render(<App />);
    expect(screen.getAllByRole('button', { name: /^filter / })).toHaveLength(8);
    expect(screen.getByLabelText('bunny layer')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^adjust .* pane$/ })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /^adjust .* layer$/ })).toHaveLength(5);
    await screen.findByText(/camera offline/);
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DisplayToggle } from '../components/display-toggle';

describe('DisplayToggle', () => {
  it('toggles a field off', async () => {
    const onChange = vi.fn();
    render(<DisplayToggle value={{ jp: true, pron: true, ko: true }} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: '번역' }));
    expect(onChange).toHaveBeenCalledWith({ jp: true, pron: true, ko: false });
  });

  it('keeps at least one field on', async () => {
    const onChange = vi.fn();
    render(<DisplayToggle value={{ jp: true, pron: false, ko: false }} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: '日本語' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

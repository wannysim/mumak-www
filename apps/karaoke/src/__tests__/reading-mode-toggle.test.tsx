import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ReadingModeToggle } from '../components/reading-mode-toggle';

describe('ReadingModeToggle', () => {
  it('enables reading mode', async () => {
    const onChange = vi.fn();
    render(<ReadingModeToggle enabled={false} onChange={onChange} />);

    const button = screen.getByRole('button', { name: /READ/ });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(button);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('describes how to return to the typeset view', () => {
    render(<ReadingModeToggle enabled onChange={() => {}} />);

    const button = screen.getByRole('button', { name: 'READ — 발음·해석 확대 모드' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveAttribute('title', '일본어 타이포그래피 중심으로 돌아가기');
  });
});

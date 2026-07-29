import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PlaybackModeToggle } from '../components/playback-mode-toggle';

describe('PlaybackModeToggle', () => {
  it('advances to the next mode on click', async () => {
    const onChange = vi.fn();
    render(<PlaybackModeToggle mode="off" onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /반복 없음/ }));
    expect(onChange).toHaveBeenCalledWith('all');
  });

  it('names the active mode for screen readers', () => {
    const { rerender } = render(<PlaybackModeToggle mode="all" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '재생 모드: 전체 반복 (다음 곡 자동재생)' })).toBeInTheDocument();

    rerender(<PlaybackModeToggle mode="one" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '재생 모드: 한 곡 반복' })).toBeInTheDocument();
  });

  it('marks itself pressed only when repeating', () => {
    const { rerender } = render(<PlaybackModeToggle mode="off" onChange={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');

    rerender(<PlaybackModeToggle mode="all" onChange={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });
});

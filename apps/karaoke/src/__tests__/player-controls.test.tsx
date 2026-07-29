import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PlayerControls } from '../components/player-controls';

type Props = React.ComponentProps<typeof PlayerControls>;

function buildProps(overrides: Partial<Props> = {}): Props {
  return {
    time: 20,
    duration: 224,
    isPlaying: false,
    onSeek: vi.fn(),
    onTogglePlay: vi.fn(),
    playbackMode: 'off',
    onPlaybackModeChange: vi.fn(),
    ...overrides,
  };
}

function setup(overrides: Partial<Props> = {}) {
  const props = buildProps(overrides);
  render(<PlayerControls {...props} />);
  return props;
}

/** 폴링으로 time만 갱신되는 상황을 재현하려면 같은 콜백으로 다시 그려야 한다. */
function renderControls(overrides: Partial<Props> = {}) {
  const props = buildProps(overrides);
  const view = render(<PlayerControls {...props} />);
  return {
    ...props,
    rerender: (next: Partial<Props>) => view.rerender(<PlayerControls {...props} {...next} />),
  };
}

describe('PlayerControls', () => {
  it('shows elapsed and total time', () => {
    setup();
    expect(screen.getByText('0:20')).toBeInTheDocument();
    expect(screen.getByText('3:44')).toBeInTheDocument();
  });

  it('holds a placeholder until the duration is known', () => {
    setup({ duration: 0 });
    expect(screen.getByText('--:--')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: '재생 위치' })).toBeDisabled();
  });

  it('toggles playback and swaps the label', async () => {
    const { onTogglePlay } = setup({ isPlaying: true });

    const button = screen.getByRole('button', { name: '일시정지' });
    await userEvent.click(button);

    expect(onTogglePlay).toHaveBeenCalledTimes(1);
  });

  it('bounds the seek slider by the duration', () => {
    setup();
    const slider = screen.getByRole('slider', { name: '재생 위치' });

    expect(slider).toHaveAttribute('min', '0');
    expect(slider).toHaveAttribute('max', '224');
    expect(slider).toHaveValue('20');
  });

  it('seeks only once the user lets go, not while dragging', () => {
    const { onSeek } = setup();
    const slider = screen.getByRole('slider', { name: '재생 위치' });

    fireEvent.change(slider, { target: { value: '100' } });
    // 드래그 중에 매번 탐색하면 재생이 끊긴다. 화면 값만 따라가야 한다.
    expect(onSeek).not.toHaveBeenCalled();
    expect(slider).toHaveValue('100');

    fireEvent.pointerUp(slider);
    expect(onSeek).toHaveBeenCalledExactlyOnceWith(100);
  });

  it('keeps showing the dragged position instead of snapping back to polled time', () => {
    const { rerender } = renderControls({ time: 20, duration: 224 });
    const slider = screen.getByRole('slider', { name: '재생 위치' });

    fireEvent.change(slider, { target: { value: '150' } });
    // 폴링이 다음 재생 시간을 밀어 넣어도 손가락 위치가 유지되어야 한다.
    rerender({ time: 21, duration: 224 });

    expect(slider).toHaveValue('150');
    expect(screen.getByText('2:30')).toBeInTheDocument();
  });

  it('carries the playback mode toggle', async () => {
    const { onPlaybackModeChange } = setup();

    await userEvent.click(screen.getByRole('button', { name: /재생 모드/ }));

    expect(onPlaybackModeChange).toHaveBeenCalledWith('all');
  });
});

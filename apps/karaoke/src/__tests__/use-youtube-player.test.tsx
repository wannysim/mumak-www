import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useYouTubePlayer, type YouTubeApi } from '../hooks/use-youtube-player';

type PlayerEvents = {
  onReady?: () => void;
  onStateChange?: (event: { data: number }) => void;
};

class FakePlayer {
  static last: FakePlayer | undefined;
  currentTime = 0;
  events: PlayerEvents;
  loadVideoById = vi.fn();
  playVideo = vi.fn();
  pauseVideo = vi.fn();
  destroy = vi.fn();
  seekTo = vi.fn((seconds: number) => {
    this.currentTime = seconds;
  });

  constructor(_element: HTMLElement, options: { videoId: string; events?: PlayerEvents }) {
    this.events = options.events ?? {};
    FakePlayer.last = this;
  }

  getCurrentTime() {
    return this.currentTime;
  }
}

function Probe({ videoId }: { videoId: string }) {
  const { containerRef, time, isPlaying, seekTo, togglePlay } = useYouTubePlayer(videoId);
  return (
    <div>
      <div ref={containerRef} />
      <output>{time}</output>
      <span data-testid="playing">{String(isPlaying)}</span>
      <button type="button" onClick={() => seekTo(42)}>
        seek
      </button>
      <button type="button" onClick={togglePlay}>
        toggle
      </button>
    </div>
  );
}

async function renderReadyProbe(videoId = 'first') {
  const view = render(<Probe videoId={videoId} />);
  await act(async () => {});
  act(() => FakePlayer.last?.events.onReady?.());
  return view;
}

describe('useYouTubePlayer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.YT = {
      Player: FakePlayer as unknown as YouTubeApi['Player'],
      PlayerState: { PLAYING: 1 },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    FakePlayer.last = undefined;
  });

  it('polls current time while playing', async () => {
    await renderReadyProbe();
    act(() => FakePlayer.last?.events.onStateChange?.({ data: 1 }));
    expect(screen.getByTestId('playing')).toHaveTextContent('true');

    FakePlayer.last!.currentTime = 3.5;
    act(() => vi.advanceTimersByTime(250));
    expect(screen.getByRole('status')).toHaveTextContent('3.5');

    act(() => FakePlayer.last?.events.onStateChange?.({ data: 2 }));
    FakePlayer.last!.currentTime = 99;
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole('status')).toHaveTextContent('3.5');
  });

  it('seeks, resumes playback, and updates time immediately', async () => {
    await renderReadyProbe();
    act(() => screen.getByRole('button', { name: 'seek' }).click());
    expect(FakePlayer.last!.seekTo).toHaveBeenCalledWith(42, true);
    expect(FakePlayer.last!.playVideo).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('42');
  });

  it('loads a new video and resets time when videoId changes', async () => {
    const { rerender } = await renderReadyProbe();
    act(() => screen.getByRole('button', { name: 'seek' }).click());

    rerender(<Probe videoId="second" />);
    expect(FakePlayer.last!.loadVideoById).toHaveBeenCalledWith('second');
    expect(screen.getByRole('status')).toHaveTextContent('0');
  });

  it('toggles between play and pause', async () => {
    await renderReadyProbe();
    const toggle = screen.getByRole('button', { name: 'toggle' });

    act(() => toggle.click());
    expect(FakePlayer.last!.playVideo).toHaveBeenCalled();

    act(() => FakePlayer.last?.events.onStateChange?.({ data: 1 }));
    act(() => toggle.click());
    expect(FakePlayer.last!.pauseVideo).toHaveBeenCalled();
  });

  it('destroys the player on unmount', async () => {
    const { unmount } = await renderReadyProbe();
    unmount();
    expect(FakePlayer.last!.destroy).toHaveBeenCalled();
  });
});

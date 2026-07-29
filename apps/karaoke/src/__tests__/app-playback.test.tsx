import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import App, { KARAOKE_GUIDE_KEY, PRIVACY_CONSENT_KEY } from '../app';
import type { YouTubeApi } from '../hooks/use-youtube-player';

type Events = { onReady?: () => void; onStateChange?: (event: { data: number }) => void };

class FakePlayer {
  static last: FakePlayer | undefined;
  events: Events;
  loadVideoById = vi.fn();
  playVideo = vi.fn();
  pauseVideo = vi.fn();
  destroy = vi.fn();
  getDuration = vi.fn(() => 224);
  seekTo = vi.fn();

  constructor(_el: HTMLElement, options: { videoId: string; events?: Events }) {
    this.events = options.events ?? {};
    FakePlayer.last = this;
  }

  getCurrentTime() {
    return 0;
  }
}

/** 곡이 끝났다고 알린다. */
async function endSong() {
  await act(async () => {
    FakePlayer.last?.events.onStateChange?.({ data: 0 });
  });
}

async function renderApp(mode: 'off' | 'all' | 'one') {
  localStorage.setItem('karaoke:playback', JSON.stringify(mode));
  render(<App />);
  await act(async () => {});
  act(() => FakePlayer.last?.events.onReady?.());
}

const heading = () => screen.getByRole('heading', { level: 1 });

describe('App playback mode', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(PRIVACY_CONSENT_KEY, 'true');
    localStorage.setItem(KARAOKE_GUIDE_KEY, 'true');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false } as Response));
    window.YT = {
      Player: FakePlayer as unknown as YouTubeApi['Player'],
      PlayerState: { PLAYING: 1, ENDED: 0 },
    };
  });

  afterEach(() => {
    FakePlayer.last = undefined;
    vi.unstubAllGlobals();
  });

  it('stops on the same song when repeat is off', async () => {
    await renderApp('off');
    await endSong();

    expect(heading()).toHaveTextContent('怪獣の花唄');
    expect(FakePlayer.last!.seekTo).not.toHaveBeenCalled();
    expect(FakePlayer.last!.loadVideoById).not.toHaveBeenCalled();
  });

  it('restarts the same song when repeating one', async () => {
    await renderApp('one');
    await endSong();

    expect(FakePlayer.last!.seekTo).toHaveBeenCalledWith(0, true);
    expect(FakePlayer.last!.playVideo).toHaveBeenCalled();
    expect(heading()).toHaveTextContent('怪獣の花唄');
  });

  it('advances to the next song when repeating all', async () => {
    await renderApp('all');
    await endSong();

    expect(heading()).toHaveTextContent('踊り子');
    expect(FakePlayer.last!.loadVideoById).toHaveBeenCalledWith('CnlMTBwsBHs');
  });

  it('wraps from the last song back to the first', async () => {
    localStorage.setItem('karaoke:song', '"time-paradox"');
    await renderApp('all');
    await endSong();

    expect(heading()).toHaveTextContent('怪獣の花唄');
  });

  it('follows the mode chosen after mount, not the one captured at mount', async () => {
    await renderApp('off');

    await act(async () => {
      screen.getByRole('button', { name: /재생 모드: 반복 없음/ }).click();
    });
    await endSong();

    expect(heading()).toHaveTextContent('踊り子');
  });
});

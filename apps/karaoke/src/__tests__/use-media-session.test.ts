import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useMediaSession } from '../hooks/use-media-session';

// jsdom은 Media Session API를 구현하지 않는다. 훅이 실제로 무엇을 등록하는지 보려면 직접 세운다.
function stubMediaSession({ unsupported = [] }: { unsupported?: string[] } = {}) {
  const handlers = new Map<string, (() => void) | null>();
  const session = {
    metadata: null as { title: string; artist: string } | null,
    playbackState: 'none',
    setActionHandler: vi.fn((action: string, handler: (() => void) | null) => {
      if (unsupported.includes(action)) throw new TypeError(`unsupported action: ${action}`);
      handlers.set(action, handler);
    }),
  };
  Object.defineProperty(navigator, 'mediaSession', { value: session, configurable: true });
  Reflect.set(
    globalThis,
    'MediaMetadata',
    class {
      title: string;
      artist: string;
      constructor(init: { title: string; artist: string }) {
        this.title = init.title;
        this.artist = init.artist;
      }
    }
  );
  return { session, invoke: (action: string) => handlers.get(action)?.() };
}

const baseProps = {
  title: '怪獣の花唄',
  artist: 'Vaundy',
  isPlaying: false,
  onPlay: () => {},
  onPause: () => {},
  onPreviousTrack: () => {},
  onNextTrack: () => {},
};

describe('useMediaSession', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'mediaSession');
    Reflect.deleteProperty(globalThis, 'MediaMetadata');
  });

  it('routes each OS media action to its handler', () => {
    const spies = {
      onPlay: vi.fn(),
      onPause: vi.fn(),
      onPreviousTrack: vi.fn(),
      onNextTrack: vi.fn(),
    };
    const { invoke } = stubMediaSession();
    renderHook(() => useMediaSession({ ...baseProps, ...spies }));

    // 맥북 F8은 play와 pause를 각각 보낸다. 토글로 묶으면 상태가 어긋날 때 반대로 동작한다.
    invoke('play');
    invoke('pause');
    invoke('previoustrack');
    invoke('nexttrack');

    expect(spies.onPlay).toHaveBeenCalledOnce();
    expect(spies.onPause).toHaveBeenCalledOnce();
    expect(spies.onPreviousTrack).toHaveBeenCalledOnce();
    expect(spies.onNextTrack).toHaveBeenCalledOnce();
  });

  it('calls the latest handler after the song changes', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { invoke } = stubMediaSession();
    const view = renderHook(props => useMediaSession(props), {
      initialProps: { ...baseProps, onNextTrack: first },
    });

    view.rerender({ ...baseProps, onNextTrack: second });
    invoke('nexttrack');

    // 등록은 한 번만 하므로 ref 갱신이 깨지면 낡은 클로저가 남아 예전 곡 기준으로 넘어간다.
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it('mirrors playback state and metadata for the OS Now Playing widget', () => {
    const { session } = stubMediaSession();
    const view = renderHook(props => useMediaSession(props), {
      initialProps: { ...baseProps, isPlaying: false },
    });

    expect(session.playbackState).toBe('paused');
    expect(session.metadata).toMatchObject({ title: '怪獣の花唄', artist: 'Vaundy' });

    view.rerender({ ...baseProps, isPlaying: true, title: '踊り子' });

    expect(session.playbackState).toBe('playing');
    expect(session.metadata).toMatchObject({ title: '踊り子' });
  });

  it('keeps the remaining actions when the browser rejects one', () => {
    const onNextTrack = vi.fn();
    const { session, invoke } = stubMediaSession({ unsupported: ['previoustrack'] });
    renderHook(() => useMediaSession({ ...baseProps, onNextTrack }));

    invoke('nexttrack');

    expect(onNextTrack).toHaveBeenCalledOnce();
    expect(session.setActionHandler).toHaveBeenCalledWith('nexttrack', expect.any(Function));
  });

  it('does not unregister an action the browser rejected', () => {
    const { session } = stubMediaSession({ unsupported: ['previoustrack'] });
    const view = renderHook(() => useMediaSession(baseProps));

    view.unmount();

    expect(session.setActionHandler).not.toHaveBeenCalledWith('previoustrack', null);
    expect(session.setActionHandler).toHaveBeenCalledWith('nexttrack', null);
  });

  it('releases the session on unmount so a stale tab stops answering media keys', () => {
    const { session } = stubMediaSession();
    const view = renderHook(() => useMediaSession(baseProps));

    view.unmount();

    expect(session.playbackState).toBe('none');
    for (const action of ['play', 'pause', 'previoustrack', 'nexttrack']) {
      expect(session.setActionHandler).toHaveBeenCalledWith(action, null);
    }
  });

  it('does nothing when the browser has no Media Session API', () => {
    expect(() => renderHook(() => useMediaSession(baseProps))).not.toThrow();
  });
});

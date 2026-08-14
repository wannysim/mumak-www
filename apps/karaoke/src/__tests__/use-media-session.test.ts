import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useMediaSession } from '../hooks/use-media-session';

// jsdom은 미디어 재생을 구현하지 않는다. 무음 트랙이 실제로 도는지 보려면 재생 상태를 직접 흉내 낸다.
// createObjectURL은 jsdom 버전에 따라 없을 수 있어 먼저 자리를 만들어 두고 spy를 건다.
URL.createObjectURL ??= () => 'blob:stub';
URL.revokeObjectURL ??= () => {};

function stubSilentTrack() {
  const blobs: Blob[] = [];
  const played: HTMLMediaElement[] = [];
  let paused = true;

  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(() => paused);
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    played.push(this);
    paused = false;
    return Promise.resolve();
  });
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {
    paused = true;
  });
  const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
    blobs.push(blob as Blob);
    return 'blob:silent-track';
  });
  const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

  return {
    blobs,
    createObjectURL,
    play,
    pause,
    revokeObjectURL,
    element: () => played.at(-1),
  };
}

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
  let track: ReturnType<typeof stubSilentTrack>;

  beforeEach(() => {
    track = stubSilentTrack();
  });

  afterEach(() => {
    // RTL 자동 정리보다 먼저 언마운트한다. 스텁을 되돌린 뒤에 언마운트되면 jsdom의 미구현 pause가 불린다.
    cleanup();
    vi.restoreAllMocks();
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

    expect(track.createObjectURL).not.toHaveBeenCalled();
  });

  // 이 앱의 소리는 전부 YouTube iframe이 낸다. 최상위 프레임에 재생 중인 플레이어가 하나도 없으면
  // 브라우저는 미디어 세션 주인을 iframe으로 잡고, 여기 등록한 핸들러는 한 번도 불리지 않는다.
  // (일시정지만 듣는 것처럼 보이는 건 YouTube가 자기 pause 핸들러로 처리하기 때문이다.)
  describe('silent top-frame track', () => {
    it('plays while the song plays so media keys reach this page, not the iframe', () => {
      stubMediaSession();
      const view = renderHook(props => useMediaSession(props), {
        initialProps: { ...baseProps, isPlaying: false },
      });

      expect(track.play).not.toHaveBeenCalled();

      view.rerender({ ...baseProps, isPlaying: true });

      expect(track.play).toHaveBeenCalledOnce();
      // 한 번 끝나고 멈추면 세션 주인이 iframe으로 되돌아간다.
      expect(track.element()?.loop).toBe(true);
    });

    // 브라우저가 OS에 넘기는 재생 상태는 "탭에 재생 중인 플레이어가 있는가"로 정해진다.
    // 곡을 멈춘 뒤에도 무음 트랙이 돌면 OS는 계속 재생 중으로 보고, F8 같은 토글 키가
    // 매번 pause로만 해석돼 다시 눌러도 재생이 안 된다.
    it('stops with the song so the OS toggle key can resume', () => {
      stubMediaSession();
      const view = renderHook(props => useMediaSession(props), {
        initialProps: { ...baseProps, isPlaying: true },
      });

      view.rerender({ ...baseProps, isPlaying: false });

      expect(track.pause).toHaveBeenCalledOnce();

      view.rerender({ ...baseProps, isPlaying: true });

      expect(track.play).toHaveBeenCalledTimes(2);
    });

    it('is a silent WAV longer than the browser transient-media cutoff', async () => {
      stubMediaSession();
      renderHook(() => useMediaSession(baseProps));

      const [blob] = track.blobs;
      expect(blob?.type).toBe('audio/wav');
      const bytes = new Uint8Array(await blob!.arrayBuffer());
      const header = new DataView(bytes.buffer);

      expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe('RIFF');
      expect(String.fromCharCode(...bytes.subarray(8, 12))).toBe('WAVE');

      const channels = header.getUint16(22, true);
      const sampleRate = header.getUint32(24, true);
      const bitDepth = header.getUint16(34, true);
      const dataBytes = header.getUint32(40, true);

      // 5초 이하면 브라우저가 transient로 분류해 세션을 오래 붙잡지 못한다.
      expect(dataBytes / (sampleRate * channels * (bitDepth / 8))).toBeGreaterThan(5);
      expect(dataBytes).toBe(bytes.length - 44);
      // 8bit PCM의 무음은 0이 아니라 128이다. 0으로 채우면 최대 음량의 DC 오프셋이 흘러나온다.
      expect(bytes.subarray(44).every(sample => sample === 128)).toBe(true);
    });

    it('stops and frees the track on unmount', () => {
      stubMediaSession();
      const view = renderHook(props => useMediaSession(props), {
        initialProps: { ...baseProps, isPlaying: true },
      });

      view.unmount();

      expect(track.pause).toHaveBeenCalled();
      expect(track.revokeObjectURL).toHaveBeenCalledWith('blob:silent-track');
    });
  });
});

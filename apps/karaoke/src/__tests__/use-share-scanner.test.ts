import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useShareScanner } from '../hooks/use-share-scanner';
import type { StoredLyricsEntry } from '../lib/lyrics-import';
import { createKaraokeShareBundle, type KaraokeShareBundle } from '../lib/share/bundle';
import { createShareFrameStream, shareProfile, type ShareProfileId } from '../lib/share/frames';
import type { ScanLoopOptions } from '../lib/share/scan-loop';
import { createDefaultSongLibrary } from '../lib/song-library';

const scanLoop = vi.hoisted(() => ({
  options: null as ScanLoopOptions | null,
  stop: vi.fn(),
}));

vi.mock('@/lib/share/scan-loop', () => ({
  startScanLoop: (options: ScanLoopOptions) => {
    scanLoop.options = options;
    return { stop: scanLoop.stop };
  },
}));

/** 블록이 여러 개 나와야 랭크·ETA 계산을 볼 수 있다. */
const bulkLyrics: StoredLyricsEntry[] = [
  {
    slug: 'kaiju-no-hanauta',
    lyrics: Array.from({ length: 400 }, (_, index) => ({
      time: index * 4.2,
      jp: `思い出すのは ${index} 君の歌 ${index * 97}`,
      pron: `오모이다스노와 ${index} 키미노 우타 ${index * 193}`,
      ko: `떠올리는 것은 ${index} 너의 노래 ${index * 389}`,
    })),
  },
];

function bundleOf(lyrics?: StoredLyricsEntry[]): KaraokeShareBundle {
  const library = createDefaultSongLibrary();
  return createKaraokeShareBundle({
    library,
    kind: 'playlist',
    playlistId: 'vaundy',
    songSlug: library.playlists[0]!.songSlugs[0]!,
    lyrics,
  });
}

async function poolFrames(profileId: ShareProfileId, lyrics?: StoredLyricsEntry[]) {
  const stream = await createShareFrameStream(bundleOf(lyrics), shareProfile(profileId));
  return { stream, frames: Array.from({ length: stream.blockCount }, (_, index) => stream.frameAt(index)) };
}

const cameraTrack = { stop: vi.fn() };
const cameraStream = { getTracks: () => [cameraTrack] } as unknown as MediaStream;
const getUserMedia = vi.fn<() => Promise<MediaStream>>();

let clock = 0;

function renderScanner(active = true) {
  const onComplete = vi.fn();
  const onError = vi.fn();
  const view = renderHook(() => useShareScanner({ active, onComplete, onError }));
  view.result.current.videoRef.current = document.createElement('video');
  return { ...view, onComplete, onError };
}

async function startCamera(scanner: ReturnType<typeof renderScanner>) {
  await act(async () => {
    await scanner.result.current.start();
  });
}

async function feed(frames: readonly string[]) {
  for (const frame of frames) {
    await act(async () => {
      scanLoop.options?.onSymbol(frame);
      scanLoop.options?.onScanTick(1);
      await Promise.resolve();
    });
  }
}

beforeEach(() => {
  clock = 1000;
  scanLoop.options = null;
  scanLoop.stop.mockReset();
  cameraTrack.stop.mockReset();
  getUserMedia.mockReset().mockResolvedValue(cameraStream);
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  HTMLMediaElement.prototype.play = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'mediaDevices');
});

describe('useShareScanner', () => {
  it('asks for an ideal 4K 60fps rear camera with continuous focus', async () => {
    const scanner = renderScanner();

    await startCamera(scanner);

    expect(getUserMedia).toHaveBeenCalledWith({
      video: {
        facingMode: 'environment',
        width: { ideal: 3840 },
        height: { ideal: 2160 },
        frameRate: { ideal: 60 },
        advanced: [{ focusMode: 'continuous' }],
      },
    });
    expect(scanner.result.current.scanning).toBe(true);
    expect(scanner.result.current.starting).toBe(false);
  });

  it('tells the scan loop the sender lane count and says "unknown" before the first MK3 frame', async () => {
    // 회전 스케줄을 켜고 끄는 유일한 입력이다. 여기서 모른다(null)를 1로 잘못 돌려주면 2레인 전송이
    // 통째로 죽는데 나머지 단위 테스트는 전부 통과한다 — 느린 e2e 두 개만 잡는다.
    const max = await poolFrames('max', bulkLyrics);
    const safe = await poolFrames('safe', bulkLyrics);
    expect(max.stream.blockCount).toBeGreaterThan(1);
    expect(safe.stream.blockCount).toBeGreaterThan(1);

    const scanner = renderScanner();
    await startCamera(scanner);
    expect(scanLoop.options!.getLaneCount()).toBeNull();

    await feed([max.frames[0]!]);
    expect(scanLoop.options!.getLaneCount()).toBe(2);

    await feed([safe.frames[0]!]);
    expect(scanLoop.options!.getLaneCount()).toBe(1);
  });

  it('stops the camera and hands over the bundle as soon as the object is complete', async () => {
    const { frames } = await poolFrames('safe');
    const scanner = renderScanner();
    await startCamera(scanner);

    await feed(frames);
    await waitFor(() => expect(scanner.onComplete).toHaveBeenCalledOnce());

    expect(scanner.onComplete.mock.calls[0]![0]).toMatchObject({ scope: { kind: 'playlist' } });
    expect(scanLoop.stop).toHaveBeenCalled();
    expect(cameraTrack.stop).toHaveBeenCalled();
    expect(scanner.result.current.scanning).toBe(false);
    expect(scanner.result.current.decoding).toBe(false);
    expect(scanner.onError).not.toHaveBeenCalled();
  });

  it('measures scan rate, throughput and remaining time from the collector progress', async () => {
    const { stream, frames } = await poolFrames('safe', bulkLyrics);
    expect(stream.blockCount).toBeGreaterThan(4);
    const scanner = renderScanner();
    await startCamera(scanner);

    await feed(frames.slice(0, 1));
    expect(scanner.result.current.stats).toMatchObject({ rank: 1, blockCount: stream.blockCount, elapsedMs: 0 });

    clock += 1000;
    await feed(frames.slice(1, 2));
    expect(scanner.result.current.stats).toMatchObject({ rank: 2, elapsedMs: 1000, scansPerSecond: 2 });

    // 250ms 스로틀: 같은 시각에 들어온 프레임은 리렌더를 만들지 않는다.
    await feed(frames.slice(2, 3));
    expect(scanner.result.current.stats.rank).toBe(2);

    clock += 1000;
    await feed(frames.slice(3, 4));
    const stats = scanner.result.current.stats;
    expect(stats.elapsedMs).toBe(2000);
    expect(stats.rank).toBe(4);
    expect(stats.scansPerSecond).toBe(2);
    expect(stats.bytesPerSecond).toBeCloseTo(2 * shareProfile('safe').blockBytes, 5);
    expect(stats.etaSeconds).toBeCloseTo((stream.blockCount - 4) / 2, 5);
    expect(stats.droppedSymbols).toBe(0);
  });

  it('counts an unreadable frame as dropped without stopping the scan', async () => {
    const scanner = renderScanner();
    await startCamera(scanner);

    await feed(['not a share frame at all']);

    expect(scanner.result.current.stats.droppedSymbols).toBe(1);
    expect(scanner.onError).not.toHaveBeenCalled();
    expect(scanLoop.stop).not.toHaveBeenCalled();
  });

  it('explains an old sender and clears the collector', async () => {
    const scanner = renderScanner();
    await startCamera(scanner);

    await feed(['MK2:0123456789ABCDEF01234567:0:1:0']);

    expect(scanner.onError).toHaveBeenCalledWith(expect.stringContaining('오래된 버전입니다'));
    expect(scanner.result.current.stats).toMatchObject({ rank: 0, blockCount: 0 });
    expect(cameraTrack.stop).toHaveBeenCalled();
  });

  it('reports a browser that cannot decompress the completed object', async () => {
    const { frames } = await poolFrames('safe');
    const scanner = renderScanner();
    await startCamera(scanner);

    vi.stubGlobal('DecompressionStream', undefined);
    await feed(frames);
    await waitFor(() => expect(scanner.onError).toHaveBeenCalledOnce());

    expect(scanner.onError).toHaveBeenCalledWith(expect.stringContaining('압축을 지원하지 않습니다'));
    expect(scanner.onComplete).not.toHaveBeenCalled();
  });

  it('explains a denied permission and a browser without a camera', async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
    const scanner = renderScanner();

    await startCamera(scanner);
    expect(scanner.onError).toHaveBeenCalledWith(expect.stringContaining('카메라 권한이 필요합니다'));
    expect(scanner.result.current.scanning).toBe(false);

    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
    await startCamera(scanner);
    expect(scanner.onError).toHaveBeenLastCalledWith(
      expect.stringContaining('이 브라우저에서는 카메라를 쓸 수 없습니다')
    );
  });

  it('reports a missing video element and a non-Error rejection', async () => {
    const cameraErrors = vi.fn();
    const scanner = renderHook(() => useShareScanner({ active: true, onComplete: vi.fn(), onError: cameraErrors }));

    await act(async () => {
      await scanner.result.current.start();
    });
    expect(cameraErrors).toHaveBeenCalledWith('카메라 화면을 준비하지 못했습니다.');

    scanner.result.current.videoRef.current = document.createElement('video');
    getUserMedia.mockRejectedValueOnce('unknown failure');
    await act(async () => {
      await scanner.result.current.start();
    });
    expect(cameraErrors).toHaveBeenLastCalledWith('카메라를 시작하지 못했습니다.');
  });

  it('drops a start that resolves after the caller already stopped', async () => {
    let finishStarting = (_stream: MediaStream) => {};
    getUserMedia.mockImplementationOnce(
      () =>
        new Promise<MediaStream>(resolve => {
          finishStarting = resolve;
        })
    );
    const scanner = renderScanner();

    const pending = act(async () => {
      const started = scanner.result.current.start();
      scanner.result.current.reset();
      finishStarting(cameraStream);
      await started;
    });
    await pending;

    expect(cameraTrack.stop).toHaveBeenCalledOnce();
    expect(scanLoop.options).toBeNull();
    expect(scanner.result.current.scanning).toBe(false);
  });

  it('stops the camera when the tab is hidden, when it goes inactive and on unmount', async () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const scanner = renderScanner();
    await startCamera(scanner);

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(scanLoop.stop).toHaveBeenCalledOnce();
    hidden.mockReturnValue(false);

    const inactive = renderHook(({ active }) => useShareScanner({ active, onComplete: vi.fn(), onError: vi.fn() }), {
      initialProps: { active: true },
    });
    inactive.result.current.videoRef.current = document.createElement('video');
    await act(async () => {
      await inactive.result.current.start();
    });
    expect(scanLoop.stop).toHaveBeenCalledTimes(1);
    inactive.rerender({ active: false });
    expect(scanLoop.stop).toHaveBeenCalledTimes(2);

    await startCamera(scanner);
    scanner.unmount();
    expect(scanLoop.stop).toHaveBeenCalledTimes(3);
  });

  it('reset clears the collected progress so the next transfer starts clean', async () => {
    const { frames } = await poolFrames('safe', bulkLyrics);
    const scanner = renderScanner();
    await startCamera(scanner);
    await feed(frames.slice(0, 2));
    expect(scanner.result.current.stats.rank).toBeGreaterThan(0);

    act(() => {
      scanner.result.current.reset();
    });

    expect(scanner.result.current.stats).toMatchObject({ rank: 0, blockCount: 0, etaSeconds: null });
  });
});

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ShareDrawer } from '../components/share-drawer';
import { LOCAL_STORAGE_KEYS } from '../lib/client-storage';
import { createKaraokeShareBundle, serializeKaraokeShareBundle } from '../lib/share/bundle';
import { createShareFrameStream, shareProfile } from '../lib/share/frames';
import type { ScanLoopOptions } from '../lib/share/scan-loop';
import { createDefaultSongLibrary, SONG_LIBRARY_SCHEMA_VERSION } from '../lib/song-library';

const storage = vi.hoisted(() => ({
  readStoredLyricsLibrary: vi.fn(),
  saveStoredLyricsBatch: vi.fn(),
  withLyricsLibraryWriteLock: vi.fn((operation: () => Promise<unknown>) => operation()),
}));

/**
 * 사전 인코딩 훅은 rAF 루프를 돌린다. 드로어 테스트에서 그대로 두면 act() 밖 상태 갱신이 쏟아지므로
 * 여기서는 준비 완료 상태로 고정하고, 훅 자체는 use-share-frame-stream.test.ts가 검증한다.
 */
const frameStream = vi.hoisted(() => ({
  state: {
    lanes: [{ moduleCount: 1, bits: new Uint8Array(1) }] as readonly ({
      moduleCount: number;
      bits: Uint8Array;
    } | null)[],
    preparedRatio: 1,
    ready: true,
    error: null as string | null,
    stats: {
      symbolIndex: 0,
      displayedSymbols: 0,
      displayFps: 60,
      symbolsPerSecond: 0,
      bytesPerSecond: 0,
      elapsedMs: 0,
    },
  },
}));

const scanLoop = vi.hoisted(() => ({
  options: null as ScanLoopOptions | null,
  stop: vi.fn(),
}));

vi.mock('@/lib/lyrics-storage', () => storage);
vi.mock('@/hooks/use-share-frame-stream', () => ({ useShareFrameStream: () => frameStream.state }));
vi.mock('@/lib/share/scan-loop', () => ({
  startScanLoop: (options: ScanLoopOptions) => {
    scanLoop.options = options;
    return { stop: scanLoop.stop };
  },
}));

const lyrics = [
  {
    slug: 'kaiju-no-hanauta',
    lyrics: [{ time: 0, jp: '思い出すのは', pron: '오모이다스노와', ko: '떠올리는 것은' }],
  },
];

const cameraTrack = { stop: vi.fn() };
const cameraStream = { getTracks: () => [cameraTrack] } as unknown as MediaStream;
const getUserMedia = vi.fn<() => Promise<MediaStream>>();

function renderShareDrawer(onImport = vi.fn()) {
  const library = createDefaultSongLibrary();
  render(
    <ShareDrawer library={library} currentPlaylistId="vaundy" currentSong={library.songs[0]!} onImport={onImport} />
  );
  return { library, onImport };
}

async function openSendPanel() {
  await userEvent.click(screen.getByRole('button', { name: 'QR로 보내고 받기' }));
  await userEvent.click(screen.getByRole('button', { name: /보내기/ }));
}

async function openScanner() {
  await userEvent.click(screen.getByRole('button', { name: 'QR로 보내고 받기' }));
  await userEvent.click(screen.getByRole('button', { name: /받기/ }));
  await userEvent.click(screen.getByRole('button', { name: '카메라 켜기' }));
}

/** systematic 심볼 K개면 랭크가 가득 찬다. 손실 없는 이상적인 스캔을 흉내낸다. */
async function scanBundle(bundle: Parameters<typeof createShareFrameStream>[0]) {
  const stream = await createShareFrameStream(bundle, shareProfile('safe'));
  for (let index = 0; index < stream.blockCount; index += 1) {
    const frame = stream.frameAt(index);
    await act(async () => {
      scanLoop.options?.onSymbol(frame);
      scanLoop.options?.onScanTick(1);
      await Promise.resolve();
    });
  }
}

describe('ShareDrawer', () => {
  beforeEach(() => {
    localStorage.clear();
    storage.readStoredLyricsLibrary.mockReset().mockResolvedValue({ entries: lyrics, skippedRecordCount: 0 });
    storage.saveStoredLyricsBatch.mockReset().mockResolvedValue(undefined);
    storage.withLyricsLibraryWriteLock.mockClear();
    scanLoop.options = null;
    scanLoop.stop.mockReset();
    cameraTrack.stop.mockReset();
    getUserMedia.mockReset().mockResolvedValue(cameraStream);
    frameStream.state.ready = true;
    frameStream.state.preparedRatio = 1;
    frameStream.state.error = null;
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
    HTMLMediaElement.prototype.play = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    // jsdom에는 2D 컨텍스트가 없다. 대역 없이 두면 blit이 부를 때마다 "Not implemented" 경고가 뜬다.
    // 실제 픽셀 검증은 qr-blit.test.ts가 가짜 컨텍스트로 한다.
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'share');
    Reflect.deleteProperty(navigator, 'canShare');
    Reflect.deleteProperty(navigator, 'mediaDevices');
  });

  it('creates a looping QR for the current playlist and offers the same data as a file', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:share');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderShareDrawer();

    await userEvent.click(screen.getByRole('button', { name: 'QR로 보내고 받기' }));
    expect(screen.getByText('재생목록과 가사를 옮깁니다')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /보내기/ }));

    // 뷰 전환 직후의 focus는 우리 effect와 radix focus scope가 한 프레임 안에서 다투므로
    // 정착한 상태를 기다린다(song-drawer.test.tsx와 같은 패턴).
    await waitFor(() => expect(screen.getByRole('button', { name: '이전 화면' })).toHaveFocus());

    // focus scope가 언제 컨테이너로 focus를 되돌려도 뒤로 버튼이 이긴다.
    // share-header.tsx의 focusin 바운스는 동기라서 컨테이너는 focus를 한 순간도 유지하지 못한다.
    // 바운스를 지우면 이 단정이 실패한다(그게 CI에서 간헐적으로 터졌던 회귀다).
    screen.getByRole('dialog').focus();
    expect(screen.getByRole('button', { name: '이전 화면' })).toHaveFocus();

    expect(screen.getByRole('radio', { name: /현재 재생목록/ })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: /전체 보관함/ }));
    expect(screen.getByRole('radio', { name: /전체 보관함/ })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: /현재 곡/ }));
    expect(screen.getByRole('radio', { name: /현재 곡/ })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: /현재 재생목록/ }));
    await userEvent.click(screen.getByRole('switch', { name: '저장된 가사도 포함' }));
    expect(await screen.findByText('1곡 포함')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'QR 만들기' }));

    expect(await screen.findByLabelText('노래 데이터 공유 QR')).toBeInTheDocument();
    expect(screen.getByText(/반복 표시/)).toBeInTheDocument();
    expect(screen.getByText(/QR이 초당 20회 바뀝니다/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '이전 화면' }));
    await userEvent.click(screen.getByRole('button', { name: '공유 파일 저장' }));
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
  });

  it('labels all four speed profiles with a theoretical ceiling and the flash rate they imply', async () => {
    renderShareDrawer();
    await openSendPanel();

    expect(screen.getByRole('radio', { name: /^빠르게/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /^안정/ })).toHaveAccessibleName(/이론 최대 4\.1 KB\/s · 초당 10장/);
    expect(screen.getByRole('radio', { name: /^빠르게/ })).toHaveAccessibleName(/이론 최대 23\.7 KB\/s · 초당 20장/);
    expect(screen.getByRole('radio', { name: /^고속/ })).toHaveAccessibleName(/이론 최대 48\.6 KB\/s · 초당 30장/);
    expect(screen.getByRole('radio', { name: /^최대/ })).toHaveAccessibleName(/이론 최대 166\.5 KB\/s · 초당 60장/);
    expect(screen.getAllByRole('radio', { name: /이론 최대/ })).toHaveLength(4);
    // turbo가 네이티브 디코더에서만 빠르다는 사실을 감추면 더 느린 선택지를 빠른 줄 알고 고른다.
    // 문구는 실측이 지지하는 만큼만 말한다 — jsQR 경로에서 turbo는 fast와 사실상 같으므로 "느리다"가 아니다.
    expect(screen.getByRole('radio', { name: /^고속/ })).toHaveAccessibleName(/빠르게보다 빠르지 않습니다/);
    expect(screen.getByRole('radio', { name: /^최대/ })).toHaveAccessibleName(/폰 화면에는 2장이 함께 들어가지 않아/);
    expect(screen.getByText(/QR 한 장이 초당 20회 바뀝니다/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /^안정/ }));
    expect(screen.getByText(/QR 한 장이 초당 10회 바뀝니다/)).toBeInTheDocument();
    // 2레인은 합산 60장이지만 한 장이 바뀌는 속도는 그 절반이다. 섬광 안내는 눈이 보는 값이어야 한다.
    await userEvent.click(screen.getByRole('radio', { name: /^최대/ }));
    expect(screen.getByText(/QR 한 장이 초당 30회 바뀝니다/)).toBeInTheDocument();
  });

  it('blocks the two fastest profiles outright when the user asked for reduced motion', async () => {
    // 유일한 섬광(WCAG 2.3.1) 안전장치다. 테스트가 없으면 지워져도 아무도 모른다.
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    );
    renderShareDrawer();
    await openSendPanel();

    expect(screen.getByRole('radio', { name: /^안정/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /^빠르게/ })).toBeEnabled();
    // 기본값 강등만으로는 부족하다. 초당 20회를 넘는 선택지는 고를 수 없어야 한다.
    expect(screen.getByRole('radio', { name: /^고속/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /^최대/ })).toBeDisabled();
    expect(screen.getAllByText('모션 줄이기를 켠 기기에서는 선택할 수 없습니다.')).toHaveLength(2);
  });

  it('shows pre-encoding progress and reports an encoder failure instead of an empty screen', async () => {
    frameStream.state.ready = false;
    frameStream.state.preparedRatio = 0.5;
    renderShareDrawer();
    await openSendPanel();
    await userEvent.click(screen.getByRole('button', { name: 'QR 만들기' }));

    expect(await screen.findByText('QR 미리 만드는 중 50%')).toBeInTheDocument();
    expect(screen.getByText(/준비가 끝나면 QR이 초당 20회 바뀝니다/)).toBeInTheDocument();

    frameStream.state.error = 'QR 이미지를 만들지 못했습니다. 더 느린 속도를 선택해 주세요.';
    await userEvent.click(screen.getByRole('button', { name: '이전 화면' }));
    await userEvent.click(screen.getByRole('button', { name: 'QR 만들기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('더 느린 속도를 선택해 주세요');
  });

  it('always shares a .txt file even when canShare accepts every format, like Chrome', async () => {
    const share = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new DOMException('cancelled', 'AbortError'))
      .mockRejectedValueOnce(new Error('기기 공유 실패'))
      .mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'));
    // Chrome의 canShare()는 파일 형식을 검증하지 않고 무조건 true를 준다.
    // 형식 검증은 share() 시점의 확장자 safelist에서만 일어난다(.json은 거부 대상).
    const canShare = vi.fn(() => true);
    Object.defineProperties(navigator, {
      share: { configurable: true, value: share },
      canShare: { configurable: true, value: canShare },
    });
    renderShareDrawer();
    await openSendPanel();
    const button = screen.getByRole('button', { name: '기기로 바로 공유' });

    await userEvent.click(button);
    const sharedFile = share.mock.calls[0]![0].files[0] as File;
    expect(sharedFile).toMatchObject({ type: 'text/plain' });
    expect(sharedFile.name).toMatch(/\.txt$/);
    expect(JSON.parse(await sharedFile.text())).toMatchObject({ scope: { kind: 'playlist' } });

    await userEvent.click(button);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await userEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent('기기 공유 실패');

    await userEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent('브라우저가 이 파일 공유를 허용하지 않습니다');
  });

  it('collects camera frames, shows a change summary, and imports only after confirmation', async () => {
    const onImport = vi.fn();
    const { library } = renderShareDrawer(onImport);
    const incoming = createKaraokeShareBundle({
      library: {
        schemaVersion: SONG_LIBRARY_SCHEMA_VERSION,
        songs: [
          {
            slug: 'youtube-dQw4w9WgXcQ',
            titleJa: '新しい歌',
            titleKo: '새 노래',
            videoId: 'dQw4w9WgXcQ',
          },
        ],
        playlists: [{ id: 'shared', name: '공유', songSlugs: ['youtube-dQw4w9WgXcQ'] }],
      },
      kind: 'song',
      playlistId: 'shared',
      songSlug: 'youtube-dQw4w9WgXcQ',
      lyrics: [
        {
          slug: 'youtube-dQw4w9WgXcQ',
          lyrics: [{ time: 0, jp: '新しい歌', pron: '아타라시이 우타', ko: '새 노래' }],
        },
      ],
    });

    await openScanner();
    expect(screen.getByLabelText('QR 스캔 카메라')).toBeInTheDocument();
    expect(getUserMedia).toHaveBeenCalledOnce();
    await scanBundle(incoming);

    expect(await screen.findByText('가져오기 확인')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: '이전 화면' })).toHaveFocus());
    expect(screen.getByText('QR 수신이 끝났습니다. 가져올 내용을 확인해 주세요.')).toBeInTheDocument();
    expect(scanLoop.stop).toHaveBeenCalled();
    expect(cameraTrack.stop).toHaveBeenCalled();
    expect(screen.getAllByText('1', { selector: 'strong' })).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: '이 곡 가져오기' }));

    expect(storage.saveStoredLyricsBatch).toHaveBeenCalledWith(incoming.lyrics);
    expect(onImport).toHaveBeenCalledWith(
      expect.objectContaining({
        songs: expect.arrayContaining([expect.objectContaining({ slug: 'youtube-dQw4w9WgXcQ' })]),
      }),
      { playlistId: 'vaundy', songSlug: 'youtube-dQw4w9WgXcQ' }
    );
    expect(await screen.findByText('이 기기에 가져왔습니다')).toBeInTheDocument();
    expect(library.songs).not.toContainEqual(expect.objectContaining({ slug: 'youtube-dQw4w9WgXcQ' }));
  });

  it('loads a full-library share file and labels the destructive replacement clearly', async () => {
    const onImport = vi.fn();
    const { library } = renderShareDrawer(onImport);
    const replacement = structuredClone(library);
    const fallbackPlaylist = replacement.playlists[1]!;
    replacement.playlists = [fallbackPlaylist];
    const bundle = createKaraokeShareBundle({
      library: replacement,
      kind: 'library',
      playlistId: fallbackPlaylist.id,
      songSlug: fallbackPlaylist.songSlugs[0]!,
    });

    await userEvent.click(screen.getByRole('button', { name: 'QR로 보내고 받기' }));
    await userEvent.click(screen.getByRole('button', { name: /받기/ }));
    const input = screen.getByLabelText('공유 파일 선택');
    fireEvent.change(input, {
      target: {
        files: [new File([serializeKaraokeShareBundle(bundle)], 'share.json', { type: 'application/json' })],
      },
    });

    await screen.findByRole('button', { name: '이 기기의 보관함 교체' });
    expect(screen.getByText(/보관함에서 제외/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '이전 화면' }));
    expect(screen.getByText('보내는 기기의 QR을 맞춰 주세요')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('공유 파일 선택'), {
      target: {
        files: [new File([serializeKaraokeShareBundle(bundle)], 'share.json', { type: 'application/json' })],
      },
    });
    const replace = await screen.findByRole('button', { name: '이 기기의 보관함 교체' });
    await userEvent.click(replace);
    expect(onImport).toHaveBeenCalledWith(
      replacement,
      expect.objectContaining({ playlistId: fallbackPlaylist.id, songSlug: fallbackPlaylist.songSlugs[0] })
    );
  });

  it('uses the imported playlist as the next selection', async () => {
    const onImport = vi.fn();
    const { library } = renderShareDrawer(onImport);
    const incoming = structuredClone(library);
    incoming.playlists[0]!.songSlugs.reverse();
    const playlist = incoming.playlists[0]!;
    const bundle = createKaraokeShareBundle({
      library: incoming,
      kind: 'playlist',
      playlistId: playlist.id,
      songSlug: playlist.songSlugs[0]!,
    });

    await userEvent.click(screen.getByRole('button', { name: 'QR로 보내고 받기' }));
    await userEvent.click(screen.getByRole('button', { name: /받기/ }));
    fireEvent.change(screen.getByLabelText('공유 파일 선택'), {
      target: {
        files: [new File([serializeKaraokeShareBundle(bundle)], 'share.json', { type: 'application/json' })],
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: '이 재생목록 가져오기' }));

    expect(onImport).toHaveBeenCalledWith(expect.objectContaining({ playlists: expect.arrayContaining([playlist]) }), {
      playlistId: playlist.id,
      songSlug: playlist.songSlugs[0],
    });
  });

  it('explains a denied camera permission and rejects an invalid share file', async () => {
    getUserMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
    renderShareDrawer();

    await openScanner();
    expect(await screen.findByRole('alert')).toHaveTextContent('카메라 권한이 필요합니다');

    fireEvent.change(screen.getByLabelText('공유 파일 선택'), {
      target: {
        files: [new File(['{'], 'broken.json', { type: 'application/json' })],
      },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('JSON 형식이 올바르지 않습니다');
  });

  it('keeps the camera stopped when a pending start finishes after leaving the scanner', async () => {
    let finishStarting = (_stream: MediaStream) => {};
    getUserMedia.mockImplementationOnce(
      () =>
        new Promise<MediaStream>(resolve => {
          finishStarting = resolve;
        })
    );
    renderShareDrawer();

    await openScanner();
    expect(getUserMedia).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: '이전 화면' }));

    await act(async () => {
      finishStarting(cameraStream);
      await Promise.resolve();
    });
    expect(cameraTrack.stop).toHaveBeenCalled();
    expect(scanLoop.options).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /받기/ }));
    expect(screen.getByRole('button', { name: '카메라 켜기' })).toBeVisible();
  });

  it('reports scanner failures, stops a hidden camera, and opens the file picker fallback', async () => {
    renderShareDrawer();
    await openScanner();

    await act(async () => {
      scanLoop.options?.onSymbol('MK2:0123456789ABCDEF01234567:0:1:0');
      await Promise.resolve();
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('오래된 버전입니다');

    getUserMedia.mockRejectedValueOnce(new Error('카메라를 사용할 수 없습니다.'));
    await userEvent.click(screen.getByRole('button', { name: '카메라 켜기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('카메라를 사용할 수 없습니다');

    getUserMedia.mockRejectedValueOnce('unknown failure');
    await userEvent.click(screen.getByRole('button', { name: '카메라 켜기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('카메라를 시작하지 못했습니다');

    await userEvent.click(screen.getByRole('button', { name: '카메라 켜기' }));
    cameraTrack.stop.mockClear();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    fireEvent(document, new Event('visibilitychange'));
    expect(cameraTrack.stop).toHaveBeenCalledOnce();

    const openPicker = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    await userEvent.click(screen.getByRole('button', { name: '카메라 대신 공유 파일 불러오기' }));
    expect(openPicker).toHaveBeenCalledOnce();
  });

  it('shows lyric loading and sender fallback errors without leaving the setup screen', async () => {
    let rejectLyricsRead = (_error: Error) => {};
    storage.readStoredLyricsLibrary.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectLyricsRead = reject;
        })
    );
    renderShareDrawer();

    await openSendPanel();
    expect(screen.getByText('가사 확인 중')).toBeInTheDocument();
    await act(async () => {
      rejectLyricsRead(new Error('가사를 읽지 못했습니다.'));
    });
    expect(await screen.findByText('포함하지 않음')).toBeInTheDocument();

    vi.stubGlobal('CompressionStream', undefined);
    await userEvent.click(screen.getByRole('button', { name: 'QR 만들기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('공유 파일을 이용해 주세요');
    vi.unstubAllGlobals();

    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      throw new Error('파일을 만들 수 없습니다.');
    });
    await userEvent.click(screen.getByRole('button', { name: '공유 파일 저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('파일을 만들 수 없습니다');
  });

  it('does not overwrite lyrics when the song library cannot be persisted', async () => {
    const onImport = vi.fn();
    const { library } = renderShareDrawer(onImport);
    const incoming = createKaraokeShareBundle({
      library,
      kind: 'song',
      playlistId: 'vaundy',
      songSlug: library.songs[0]!.slug,
      lyrics,
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    await userEvent.click(screen.getByRole('button', { name: 'QR로 보내고 받기' }));
    await userEvent.click(screen.getByRole('button', { name: /받기/ }));
    fireEvent.change(screen.getByLabelText('공유 파일 선택'), {
      target: {
        files: [new File([serializeKaraokeShareBundle(incoming)], 'share.json', { type: 'application/json' })],
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: '이 곡 가져오기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('곡 보관함을 저장할 공간이나 권한이 부족합니다');
    expect(storage.saveStoredLyricsBatch).not.toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
  });

  it('restores the previous song library when saving shared lyrics fails', async () => {
    const previousLibrary = '{"previous":true}';
    localStorage.setItem(LOCAL_STORAGE_KEYS.songLibrary, previousLibrary);
    storage.saveStoredLyricsBatch.mockRejectedValueOnce(new Error('가사 저장 실패'));
    const onImport = vi.fn();
    const { library } = renderShareDrawer(onImport);
    const incoming = createKaraokeShareBundle({
      library,
      kind: 'song',
      playlistId: 'vaundy',
      songSlug: library.songs[0]!.slug,
      lyrics,
    });

    await userEvent.click(screen.getByRole('button', { name: 'QR로 보내고 받기' }));
    await userEvent.click(screen.getByRole('button', { name: /받기/ }));
    fireEvent.change(screen.getByLabelText('공유 파일 선택'), {
      target: {
        files: [new File([serializeKaraokeShareBundle(incoming)], 'share.json', { type: 'application/json' })],
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: '이 곡 가져오기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('가사 저장 실패');
    expect(localStorage.getItem(LOCAL_STORAGE_KEYS.songLibrary)).toBe(previousLibrary);
    expect(onImport).not.toHaveBeenCalled();
  });

  it('reports when both lyric saving and song-library rollback fail', async () => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.songLibrary, '{"previous":true}');
    storage.saveStoredLyricsBatch.mockRejectedValueOnce(new Error('가사 저장 실패'));
    const onImport = vi.fn();
    const { library } = renderShareDrawer(onImport);
    const incoming = createKaraokeShareBundle({
      library,
      kind: 'song',
      playlistId: 'vaundy',
      songSlug: library.songs[0]!.slug,
      lyrics,
    });
    vi.spyOn(Storage.prototype, 'setItem')
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {
        throw new DOMException('quota', 'QuotaExceededError');
      });

    await userEvent.click(screen.getByRole('button', { name: 'QR로 보내고 받기' }));
    await userEvent.click(screen.getByRole('button', { name: /받기/ }));
    fireEvent.change(screen.getByLabelText('공유 파일 선택'), {
      target: {
        files: [new File([serializeKaraokeShareBundle(incoming)], 'share.json', { type: 'application/json' })],
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: '이 곡 가져오기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('기존 곡 보관함도 복구하지 못했습니다');
    expect(onImport).not.toHaveBeenCalled();
  });
});

import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ShareDrawer } from '../components/share-drawer';
import { LOCAL_STORAGE_KEYS } from '../lib/client-storage';
import { createKaraokeShareBundle, encodeKaraokeShareFrames, serializeKaraokeShareBundle } from '../lib/share-transfer';
import { createDefaultSongLibrary, SONG_LIBRARY_SCHEMA_VERSION } from '../lib/song-library';

const storage = vi.hoisted(() => ({
  readStoredLyricsLibrary: vi.fn(),
  saveStoredLyricsBatch: vi.fn(),
  withLyricsLibraryWriteLock: vi.fn((operation: () => Promise<unknown>) => operation()),
}));

const scanner = vi.hoisted(() => ({
  callback: null as ((result: { data: string }) => void) | null,
  start: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock('@/lib/lyrics-storage', () => storage);
vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, title }: { value: string; title: string }) => (
    <div aria-label={title} data-testid="share-qr" data-value={value} />
  ),
}));
vi.mock('qr-scanner', () => ({
  default: class MockQrScanner {
    constructor(_video: HTMLVideoElement, callback: (result: { data: string }) => void) {
      scanner.callback = callback;
    }

    start() {
      return scanner.start();
    }

    destroy() {
      scanner.destroy();
    }
  },
}));

const lyrics = [
  {
    slug: 'kaiju-no-hanauta',
    lyrics: [{ time: 0, jp: '思い出すのは', pron: '오모이다스노와', ko: '떠올리는 것은' }],
  },
];

function renderShareDrawer(onImport = vi.fn()) {
  const library = createDefaultSongLibrary();
  render(
    <ShareDrawer library={library} currentPlaylistId="vaundy" currentSong={library.songs[0]!} onImport={onImport} />
  );
  return { library, onImport };
}

describe('ShareDrawer', () => {
  beforeEach(() => {
    localStorage.clear();
    storage.readStoredLyricsLibrary.mockReset().mockResolvedValue({ entries: lyrics, skippedRecordCount: 0 });
    storage.saveStoredLyricsBatch.mockReset().mockResolvedValue(undefined);
    storage.withLyricsLibraryWriteLock.mockClear();
    scanner.callback = null;
    scanner.start.mockReset().mockResolvedValue(undefined);
    scanner.destroy.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a looping QR for the current playlist and offers the same data as a file', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:share');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderShareDrawer();

    await userEvent.click(screen.getByRole('button', { name: 'QR로 보내고 받기' }));
    expect(screen.getByText('재생목록과 가사를 옮깁니다')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /보내기/ }));

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

    const qr = await screen.findByLabelText('노래 데이터 공유 QR');
    expect(qr).toHaveAttribute('data-value', expect.stringMatching(/^MK1\|/));
    expect(screen.getByText(/반복 표시/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '이전 화면' }));
    await userEvent.click(screen.getByRole('button', { name: '공유 파일 저장' }));
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
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
    const frames = await encodeKaraokeShareFrames(incoming);

    await userEvent.click(screen.getByRole('button', { name: 'QR로 보내고 받기' }));
    await userEvent.click(screen.getByRole('button', { name: /받기/ }));
    await userEvent.click(screen.getByRole('button', { name: '카메라 켜기' }));
    expect(scanner.start).toHaveBeenCalledOnce();

    for (const frame of frames) {
      await act(async () => {
        scanner.callback?.({ data: frame });
        await Promise.resolve();
      });
    }

    expect(await screen.findByText('가져오기 확인')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이전 화면' })).toHaveFocus();
    expect(screen.getByText('QR 수신이 끝났습니다. 가져올 내용을 확인해 주세요.')).toBeInTheDocument();
    expect(scanner.destroy).toHaveBeenCalled();
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
    replacement.playlists = [replacement.playlists[0]!];
    const bundle = createKaraokeShareBundle({
      library: replacement,
      kind: 'library',
      playlistId: 'vaundy',
      songSlug: replacement.songs[0]!.slug,
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
      expect.objectContaining({ playlistId: 'vaundy', songSlug: library.songs[0]!.slug })
    );
  });

  it('explains a denied camera permission and rejects an invalid share file', async () => {
    scanner.start.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
    renderShareDrawer();

    await userEvent.click(screen.getByRole('button', { name: 'QR로 보내고 받기' }));
    await userEvent.click(screen.getByRole('button', { name: /받기/ }));
    await userEvent.click(screen.getByRole('button', { name: '카메라 켜기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('카메라 권한이 필요합니다');

    fireEvent.change(screen.getByLabelText('공유 파일 선택'), {
      target: {
        files: [new File(['{'], 'broken.json', { type: 'application/json' })],
      },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('JSON 형식이 올바르지 않습니다');
  });

  it('keeps the camera stopped when a pending start finishes after leaving the scanner', async () => {
    let finishStarting = () => {};
    scanner.start.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          finishStarting = resolve;
        })
    );
    renderShareDrawer();

    await userEvent.click(screen.getByRole('button', { name: 'QR로 보내고 받기' }));
    await userEvent.click(screen.getByRole('button', { name: /받기/ }));
    await userEvent.click(screen.getByRole('button', { name: '카메라 켜기' }));
    expect(scanner.start).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: '이전 화면' }));

    await act(async () => {
      finishStarting();
      await Promise.resolve();
    });
    expect(scanner.destroy).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /받기/ }));
    expect(screen.getByRole('button', { name: '카메라 켜기' })).toBeVisible();
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
});

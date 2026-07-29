import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LyricsLibrary } from '../components/lyrics-library';

const storage = vi.hoisted(() => ({
  clearStoredLyrics: vi.fn(),
  deleteStoredLyrics: vi.fn(),
  listStoredLyrics: vi.fn(),
  readStoredLyricsLibrary: vi.fn(),
  subscribeLyricsChanges: vi.fn(() => () => {}),
  withLyricsLibraryWriteLock: vi.fn((operation: () => Promise<unknown>) => operation()),
}));

vi.mock('@/lib/lyrics-storage', () => storage);

const entries = [
  {
    slug: 'odoriko',
    lyrics: [{ time: 1, jp: '踊り子', pron: '오도리코', ko: '춤추는 아이' }],
  },
];

describe('LyricsLibrary', () => {
  beforeEach(() => {
    storage.clearStoredLyrics.mockReset().mockResolvedValue(undefined);
    storage.deleteStoredLyrics.mockReset().mockResolvedValue(undefined);
    storage.listStoredLyrics.mockReset().mockResolvedValue(['odoriko']);
    storage.readStoredLyricsLibrary.mockReset().mockResolvedValue({ entries, skippedRecordCount: 0 });
    storage.subscribeLyricsChanges.mockClear();
    storage.withLyricsLibraryWriteLock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads one re-importable backup for the stored library', async () => {
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:karaoke-backup');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<LyricsLibrary songSlugs={['odoriko', 'napori']} />);
    await screen.findByText('1/2곡');
    await userEvent.click(screen.getByRole('button', { name: '백업 내보내기' }));

    expect(storage.readStoredLyricsLibrary).toHaveBeenCalledTimes(1);
    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:karaoke-backup');
    expect(await screen.findByText('1곡의 백업을 저장했습니다.')).toBeInTheDocument();
  });

  it('preserves valid songs outside the current catalog while warning about corrupt records', async () => {
    storage.listStoredLyrics.mockResolvedValue(['odoriko', 'retired-song', 'broken-song']);
    storage.readStoredLyricsLibrary.mockResolvedValue({
      entries: [...entries, { slug: 'retired-song', lyrics: entries[0]!.lyrics }],
      skippedRecordCount: 1,
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:karaoke-backup');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<LyricsLibrary songSlugs={['odoriko']} />);
    await screen.findByText('1/1곡 · 기타 2');
    await userEvent.click(screen.getByRole('button', { name: '백업 내보내기' }));

    const backupBlob = vi.mocked(URL.createObjectURL).mock.calls[0]![0] as Blob;
    await expect(backupBlob.text()).resolves.toContain('"slug": "retired-song"');
    expect(await screen.findByText(/읽을 수 없는 1개 레코드는 제외/)).toBeInTheDocument();
  });

  it('shows a real error instead of presenting a failed lookup as an empty library', async () => {
    storage.listStoredLyrics.mockRejectedValue(new Error('IndexedDB를 열지 못했습니다.'));

    render(<LyricsLibrary songSlugs={['odoriko']} />);

    expect(await screen.findByText('확인 실패')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('IndexedDB를 열지 못했습니다.');
  });

  it('catches a clear failure without losing the current count', async () => {
    storage.clearStoredLyrics.mockRejectedValue(new Error('저장소를 비우지 못했습니다.'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<LyricsLibrary songSlugs={['odoriko']} />);
    await screen.findByText('1/1곡');
    await userEvent.click(screen.getByText('저장된 가사 관리'));
    await userEvent.click(screen.getByRole('button', { name: '저장된 가사 모두 지우기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('저장소를 비우지 못했습니다.');
    expect(screen.getByText('1/1곡')).toBeInTheDocument();
  });

  it('deletes one selected song only after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<LyricsLibrary songSlugs={['odoriko']} />);
    await screen.findByText('1/1곡');
    await userEvent.click(screen.getByText('저장된 가사 관리'));
    await userEvent.click(screen.getByRole('button', { name: 'odoriko 가사 지우기' }));

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('odoriko에 저장된 가사만'));
    expect(storage.deleteStoredLyrics).toHaveBeenCalledWith('odoriko');
    expect(await screen.findByText('odoriko 가사를 지웠습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'odoriko 가사 지우기' })).not.toBeInTheDocument();
  });
});

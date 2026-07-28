import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LyricsImportButton } from '../components/lyrics-import-button';

const storage = vi.hoisted(() => ({
  listStoredLyrics: vi.fn(),
  saveStoredLyricsBatch: vi.fn(),
  withLyricsLibraryWriteLock: vi.fn((operation: () => Promise<unknown>) => operation()),
}));

vi.mock('@/lib/lyrics-storage', () => storage);

const lines = [{ time: 1, jp: '歌', pron: '우타', ko: '노래' }];

describe('LyricsImportButton', () => {
  beforeEach(() => {
    storage.listStoredLyrics.mockReset();
    storage.listStoredLyrics.mockResolvedValue([]);
    storage.saveStoredLyricsBatch.mockReset();
    storage.saveStoredLyricsBatch.mockResolvedValue(undefined);
    storage.withLyricsLibraryWriteLock.mockClear();
  });

  it('uses recognized file names to import several songs in one transaction', async () => {
    const { container } = render(<LyricsImportButton songSlugs={['kaiju-no-hanauta', 'odoriko']} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    await userEvent.upload(input, [
      new File([JSON.stringify(lines)], 'kaiju-no-hanauta.json', { type: 'application/json' }),
      new File([JSON.stringify(lines)], 'odoriko.json', { type: 'application/json' }),
    ]);

    expect(storage.saveStoredLyricsBatch).toHaveBeenCalledTimes(1);
    expect(storage.saveStoredLyricsBatch).toHaveBeenCalledWith([
      { slug: 'kaiju-no-hanauta', lyrics: lines },
      { slug: 'odoriko', lyrics: lines },
    ]);
    expect(await screen.findByText('2곡을 이 기기에 저장했습니다.')).toBeInTheDocument();
  });

  it('restores a complete library backup regardless of its file name', async () => {
    const backup = {
      schemaVersion: 1,
      exportedAt: '2026-07-28T00:00:00.000Z',
      songs: [
        { slug: 'kaiju-no-hanauta', lyrics: lines },
        { slug: 'odoriko', lyrics: lines },
      ],
    };
    const { container } = render(<LyricsImportButton songSlugs={['kaiju-no-hanauta', 'odoriko']} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([JSON.stringify(backup)], 'karaoke-lyrics-backup.json', { type: 'application/json' });
    Object.defineProperty(file, 'size', { value: 3 * 1024 * 1024 });

    await userEvent.upload(input, file);

    expect(storage.saveStoredLyricsBatch).toHaveBeenCalledWith(backup.songs);
    expect(await screen.findByText('2곡을 이 기기에 저장했습니다.')).toBeInTheDocument();
  });

  it('preserves retired songs when restoring an older backup', async () => {
    const backup = {
      schemaVersion: 1,
      exportedAt: '2026-07-28T00:00:00.000Z',
      songs: [
        { slug: 'odoriko', lyrics: lines },
        { slug: 'retired-song', lyrics: lines },
      ],
    };
    const { container } = render(<LyricsImportButton songSlugs={['odoriko']} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    await userEvent.upload(
      input,
      new File([JSON.stringify(backup)], 'karaoke-lyrics-backup.json', { type: 'application/json' })
    );

    expect(storage.saveStoredLyricsBatch).toHaveBeenCalledWith(backup.songs);
    expect(await screen.findByText(/현재 목록에 없는 1곡도 백업 보존용으로 저장/)).toBeInTheDocument();
  });

  it('requires an explicit slug instead of guessing from an unknown file name', async () => {
    const { container } = render(<LyricsImportButton songSlugs={['kaiju-no-hanauta', 'odoriko']} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    await userEvent.upload(input, new File([JSON.stringify(lines)], 'my-lyrics.json', { type: 'application/json' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('곡을 찾을 수 없습니다.');
    expect(storage.saveStoredLyricsBatch).not.toHaveBeenCalled();
  });

  it('rejects a selection that is too large before reading every file into memory', async () => {
    const first = new File([JSON.stringify(lines)], 'kaiju-no-hanauta.json', { type: 'application/json' });
    const second = new File([JSON.stringify(lines)], 'odoriko.json', { type: 'application/json' });
    Object.defineProperty(first, 'size', { value: 13 * 1024 * 1024 });
    Object.defineProperty(second, 'size', { value: 13 * 1024 * 1024 });
    const { container } = render(<LyricsImportButton songSlugs={['kaiju-no-hanauta', 'odoriko']} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    await userEvent.upload(input, [first, second]);

    expect(await screen.findByRole('alert')).toHaveTextContent('파일의 합계는 24MB');
    expect(storage.saveStoredLyricsBatch).not.toHaveBeenCalled();
  });

  it('asks before replacing the only local copy', async () => {
    storage.listStoredLyrics.mockResolvedValue(['odoriko']);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { container } = render(<LyricsImportButton songSlugs={['odoriko']} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    await userEvent.upload(input, new File([JSON.stringify(lines)], 'odoriko.json', { type: 'application/json' }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('되돌릴 수 없습니다'));
    expect(storage.saveStoredLyricsBatch).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('shows a useful error without writing malformed content', async () => {
    const { container } = render(<LyricsImportButton songSlugs={['odoriko']} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    await userEvent.upload(input, new File(['not-json'], 'odoriko.json', { type: 'application/json' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('JSON을 읽을 수 없습니다.');
    expect(storage.saveStoredLyricsBatch).not.toHaveBeenCalled();
  });

  it('names the invalid file when one item in a multi-file import fails validation', async () => {
    const backwards = [
      { time: 2, jp: '練習の一行' },
      { time: 1, jp: '練習の二行' },
    ];
    const { container } = render(<LyricsImportButton songSlugs={['kaiju-no-hanauta', 'odoriko']} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    await userEvent.upload(input, [
      new File([JSON.stringify(lines)], 'kaiju-no-hanauta.json', { type: 'application/json' }),
      new File([JSON.stringify(backwards)], 'odoriko.json', { type: 'application/json' }),
    ]);

    expect(await screen.findByRole('alert')).toHaveTextContent('odoriko.json: 2번째 줄의 시간');
    expect(storage.saveStoredLyricsBatch).not.toHaveBeenCalled();
  });
});

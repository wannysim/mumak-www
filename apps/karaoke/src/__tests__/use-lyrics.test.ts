import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useLyrics } from '../hooks/use-lyrics';
import type { LyricLine } from '../lib/lyrics';

const storage = vi.hoisted(() => {
  let listener: ((slug: string | null) => void) | undefined;
  return {
    readStoredLyrics: vi.fn(),
    subscribeLyricsChanges: vi.fn((nextListener: (slug: string | null) => void) => {
      listener = nextListener;
      return () => {
        listener = undefined;
      };
    }),
    emit(slug: string | null) {
      listener?.(slug);
    },
  };
});

vi.mock('@/lib/lyrics-storage', () => storage);

const lines: LyricLine[] = [{ time: 1, jp: 'あ', pron: '아', ko: '아' }];

describe('useLyrics', () => {
  beforeEach(() => {
    storage.readStoredLyrics.mockReset();
    storage.subscribeLyricsChanges.mockClear();
  });

  it('loads lyrics from the local device library', async () => {
    storage.readStoredLyrics.mockResolvedValue(lines);
    const { result } = renderHook(() => useLyrics('odoriko'));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.lyrics).toEqual(lines);
    expect(storage.readStoredLyrics).toHaveBeenCalledWith('odoriko');
  });

  it('falls back to an empty ready state when nothing is stored', async () => {
    storage.readStoredLyrics.mockResolvedValue([]);
    const { result } = renderHook(() => useLyrics('unknown'));

    await waitFor(() => expect(result.current).toEqual({ lyrics: [], status: 'ready' }));
  });

  it('preserves the storage error so the UI can offer the right recovery', async () => {
    storage.readStoredLyrics.mockRejectedValue(new Error('저장된 가사 형식의 버전을 읽을 수 없습니다.'));
    const { result } = renderHook(() => useLyrics('odoriko'));

    await waitFor(() =>
      expect(result.current).toEqual({
        lyrics: [],
        status: 'error',
        errorMessage: '저장된 가사 형식의 버전을 읽을 수 없습니다.',
      })
    );
  });

  it('resets and reloads when the slug changes', async () => {
    let resolveNapori: ((lyrics: LyricLine[]) => void) | undefined;
    storage.readStoredLyrics.mockImplementation((slug: string) =>
      slug === 'odoriko'
        ? Promise.resolve(lines)
        : new Promise<LyricLine[]>(resolve => {
            resolveNapori = resolve;
          })
    );
    const { result, rerender } = renderHook(({ slug }) => useLyrics(slug), {
      initialProps: { slug: 'odoriko' },
    });
    await waitFor(() => expect(result.current.lyrics).toEqual(lines));

    rerender({ slug: 'napori' });
    expect(result.current).toEqual({ lyrics: [], status: 'loading' });
    resolveNapori?.([]);
    await waitFor(() => expect(result.current).toEqual({ lyrics: [], status: 'ready' }));
    expect(storage.readStoredLyrics).toHaveBeenLastCalledWith('napori');
  });

  it('reloads the current song when an import changes it', async () => {
    storage.readStoredLyrics.mockResolvedValueOnce([]).mockResolvedValueOnce(lines);
    const { result } = renderHook(() => useLyrics('odoriko'));
    await waitFor(() => expect(result.current.status).toBe('ready'));

    act(() => storage.emit('odoriko'));

    await waitFor(() => expect(result.current.lyrics).toEqual(lines));
  });
});

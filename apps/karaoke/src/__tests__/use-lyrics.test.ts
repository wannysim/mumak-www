import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useLyrics } from '../hooks/use-lyrics';
import type { LyricLine } from '../lib/lyrics';

const lines: LyricLine[] = [{ time: 1, jp: 'あ', pron: '아', ko: '아' }];

function mockFetch(byUrl: Record<string, LyricLine[]>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const data = byUrl[url];
      return Promise.resolve(
        data ? { ok: true, json: () => Promise.resolve(data) } : { ok: false }
      ) as Promise<Response>;
    })
  );
}

describe('useLyrics', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads lyrics json for the slug', async () => {
    mockFetch({ '/lyrics/odoriko.json': lines });
    const { result } = renderHook(() => useLyrics('odoriko'));
    await waitFor(() => expect(result.current).toEqual(lines));
  });

  it('falls back to empty when the file is missing', async () => {
    mockFetch({});
    const { result } = renderHook(() => useLyrics('unknown'));
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });

  it('resets and reloads when the slug changes', async () => {
    mockFetch({ '/lyrics/odoriko.json': lines });
    const { result, rerender } = renderHook(({ slug }) => useLyrics(slug), {
      initialProps: { slug: 'odoriko' },
    });
    await waitFor(() => expect(result.current).toEqual(lines));

    rerender({ slug: 'napori' });
    await waitFor(() => expect(result.current).toEqual([]));
  });
});

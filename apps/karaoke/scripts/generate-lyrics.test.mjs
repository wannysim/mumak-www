import { describe, expect, it, vi } from 'vitest';

import { findSyncedLyrics, isTranslationValid, parseLrc } from './generate-lyrics.mjs';

describe('lyrics generator', () => {
  it('parses, sorts, and deduplicates timestamped LRC lines', () => {
    expect(parseLrc('[ar:연습]\n[00:02.50]二行目\n[00:01.00][00:03.00]<00:01.00>一行目\n[00:02.50]중복')).toEqual([
      { time: 1, jp: '一行目', pron: '', ko: '' },
      { time: 2.5, jp: '二行目', pron: '', ko: '' },
      { time: 3, jp: '一行目', pron: '', ko: '' },
    ]);
  });

  it('falls back to the next title when LRCLIB has no exact Japanese-title match', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json([{ duration: 227, syncedLyrics: '[00:01.20]練習\n[00:02.40]二行目' }]));

    await expect(
      findSyncedLyrics(
        {
          trackNames: ['タイムパラドックス', 'Time Paradox'],
          artistNames: ['Vaundy'],
          duration: 227,
        },
        fetchMock
      )
    ).resolves.toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('prefers Japanese original lyrics over a romanized result with the same duration', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json([
        { duration: 225, syncedLyrics: '[00:01.00]Omoidasu no wa' },
        { duration: 225, syncedLyrics: '[00:01.00]思い出すのは' },
      ])
    );

    await expect(
      findSyncedLyrics({ trackNames: ['怪獣の花唄'], artistNames: ['Vaundy'], duration: 225 }, fetchMock)
    ).resolves.toEqual([{ time: 1, jp: '思い出すのは', pron: '', ko: '' }]);
  });

  it('rejects untranslated Japanese remnants but allows non-verbal cue lines', () => {
    expect(isTranslationValid('目を凝らして', { index: 0, pron: '메오 코라시테', ko: '눈을凝らして' }, 0)).toBe(false);
    expect(isTranslationValid('♪', { index: 0, pron: '♪', ko: '♪' }, 0)).toBe(true);
  });
});

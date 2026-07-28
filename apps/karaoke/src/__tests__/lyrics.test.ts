import { describe, expect, it } from 'vitest';

import { currentLineIndex, type LyricLine } from '../lib/lyrics';

const lyrics: LyricLine[] = [
  { time: 10, jp: 'a', pron: '', ko: '' },
  { time: 20, jp: 'b', pron: '', ko: '' },
  { time: 30, jp: 'c', pron: '', ko: '' },
];

describe('currentLineIndex', () => {
  it('returns -1 before the first line', () => {
    expect(currentLineIndex(lyrics, 0)).toBe(-1);
    expect(currentLineIndex(lyrics, 9.9)).toBe(-1);
  });

  it('returns the line whose time has passed', () => {
    expect(currentLineIndex(lyrics, 10)).toBe(0);
    expect(currentLineIndex(lyrics, 19.9)).toBe(0);
    expect(currentLineIndex(lyrics, 25)).toBe(1);
  });

  it('stays on the last line after its start', () => {
    expect(currentLineIndex(lyrics, 30)).toBe(2);
    expect(currentLineIndex(lyrics, 999)).toBe(2);
  });

  it('returns -1 for empty lyrics', () => {
    expect(currentLineIndex([], 10)).toBe(-1);
  });
});

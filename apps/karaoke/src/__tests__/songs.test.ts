import { describe, expect, it } from 'vitest';

import { songAt, songs } from '../songs';

describe('songAt', () => {
  it('steps forward and backward through the list', () => {
    expect(songAt(songs, songs[1]!, 1)).toBe(songs[2]);
    expect(songAt(songs, songs[1]!, -1)).toBe(songs[0]);
  });

  it('wraps around both ends', () => {
    expect(songAt(songs, songs.at(-1)!, 1)).toBe(songs[0]);
    expect(songAt(songs, songs[0]!, -1)).toBe(songs.at(-1));
  });

  it('returns the song itself for offset 0', () => {
    expect(songAt(songs, songs[3]!, 0)).toBe(songs[3]);
  });
});

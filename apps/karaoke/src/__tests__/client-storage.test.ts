import { beforeEach, describe, expect, it } from 'vitest';

import { LOCAL_STORAGE_KEYS, migrateLegacyLocalStorage } from '../lib/client-storage';

describe('client storage migration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('moves versioned localStorage keys without changing their values', () => {
    const legacyValues = [
      [LOCAL_STORAGE_KEYS.activePlaylist, 'karaoke:active-playlist-v1', '"custom"'],
      [LOCAL_STORAGE_KEYS.firstGuide, 'karaoke:first-guide-v1', 'true'],
      [LOCAL_STORAGE_KEYS.privacyConsent, 'karaoke:privacy-consent-v1', 'true'],
      [LOCAL_STORAGE_KEYS.songLibrary, 'karaoke:song-library-v2', '{"schemaVersion":3}'],
    ] as const;

    for (const [, legacyKey, value] of legacyValues) localStorage.setItem(legacyKey, value);
    migrateLegacyLocalStorage();

    for (const [currentKey, legacyKey, value] of legacyValues) {
      expect(localStorage.getItem(currentKey)).toBe(value);
      expect(localStorage.getItem(legacyKey)).toBeNull();
    }
  });

  it('keeps the current value when both key generations exist', () => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.activePlaylist, '"current"');
    localStorage.setItem('karaoke:active-playlist-v1', '"legacy"');

    migrateLegacyLocalStorage();

    expect(localStorage.getItem(LOCAL_STORAGE_KEYS.activePlaylist)).toBe('"current"');
    expect(localStorage.getItem('karaoke:active-playlist-v1')).toBeNull();
  });
});

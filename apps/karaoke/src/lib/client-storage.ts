export const LOCAL_STORAGE_KEYS = {
  activePlaylist: 'karaoke:active-playlist',
  display: 'karaoke:display',
  firstGuide: 'karaoke:first-guide',
  playback: 'karaoke:playback',
  privacyConsent: 'karaoke:privacy-consent',
  readingMode: 'karaoke:reading-mode',
  song: 'karaoke:song',
  songLibrary: 'karaoke:song-library',
  theme: 'karaoke:theme',
} as const;

export const LYRICS_DATABASE = {
  name: 'karaoke-local-library',
  storeName: 'lyrics',
  version: 1,
} as const;

const LEGACY_LOCAL_STORAGE_KEYS = [
  [LOCAL_STORAGE_KEYS.activePlaylist, 'karaoke:active-playlist-v1'],
  [LOCAL_STORAGE_KEYS.firstGuide, 'karaoke:first-guide-v1'],
  [LOCAL_STORAGE_KEYS.privacyConsent, 'karaoke:privacy-consent-v1'],
  [LOCAL_STORAGE_KEYS.songLibrary, 'karaoke:song-library-v2'],
] as const;

export function migrateLegacyLocalStorage(): void {
  let storage: Storage;
  try {
    storage = globalThis.localStorage;
  } catch {
    return;
  }

  for (const [currentKey, legacyKey] of LEGACY_LOCAL_STORAGE_KEYS) {
    try {
      const legacyValue = storage.getItem(legacyKey);
      if (legacyValue === null) continue;
      if (storage.getItem(currentKey) === null) storage.setItem(currentKey, legacyValue);
      storage.removeItem(legacyKey);
    } catch {
      // 쓰기가 막힌 환경에서는 기존 값을 남겨 다음 실행에서 다시 시도한다.
    }
  }
}

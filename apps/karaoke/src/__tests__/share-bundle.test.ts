import { describe, expect, it } from 'vitest';

import type { StoredLyricsEntry } from '../lib/lyrics-import';
import {
  createKaraokeShareBundle,
  parseKaraokeShareBundle,
  parseKaraokeShareText,
  serializeKaraokeShareBundle,
} from '../lib/share/bundle';
import { createDefaultSongLibrary, SONG_LIBRARY_SCHEMA_VERSION } from '../lib/song-library';

const sampleLyrics: StoredLyricsEntry[] = [
  {
    slug: 'kaiju-no-hanauta',
    lyrics: Array.from({ length: 80 }, (_, index) => ({
      time: index * 4.2,
      jp: `思い出すのは ${index} 君の歌 ${index * 97}`,
      pron: `오모이다스노와 ${index} 키미노 우타 ${index * 193}`,
      ko: `떠올리는 것은 ${index} 너의 노래 ${index * 389}`,
    })),
  },
  {
    slug: 'fujii-kaze-kirari',
    lyrics: [{ time: 0, jp: '荒れ狂う季節の中を', pron: '아레쿠루우 키세츠노 나카오', ko: '거친 계절 속을' }],
  },
];

describe('karaoke share bundle', () => {
  it('filters lyrics to the selected scope', () => {
    const library = createDefaultSongLibrary();
    const bundle = createKaraokeShareBundle({
      library,
      kind: 'playlist',
      playlistId: 'vaundy',
      songSlug: library.playlists[0]!.songSlugs[0]!,
      lyrics: sampleLyrics,
    });

    expect(bundle.scope.kind).toBe('playlist');
    expect(bundle.lyrics?.map(entry => entry.slug)).toEqual(['kaiju-no-hanauta']);
  });

  it('rejects a share scope that cannot be found in the library', () => {
    const library = createDefaultSongLibrary();
    expect(() =>
      createKaraokeShareBundle({ library, kind: 'playlist', playlistId: 'missing', songSlug: 'kaiju-no-hanauta' })
    ).toThrow('공유할 재생목록을 찾을 수 없습니다');
    expect(() =>
      createKaraokeShareBundle({ library, kind: 'song', playlistId: 'vaundy', songSlug: 'missing' })
    ).toThrow('공유할 곡을 찾을 수 없습니다');
  });

  it('strictly validates share files instead of replacing malformed data with defaults', () => {
    const library = createDefaultSongLibrary();
    const bundle = createKaraokeShareBundle({
      library,
      kind: 'song',
      playlistId: 'vaundy',
      songSlug: 'kaiju-no-hanauta',
      lyrics: sampleLyrics,
    });

    expect(parseKaraokeShareText(serializeKaraokeShareBundle(bundle))).toEqual(bundle);
    expect(() => parseKaraokeShareText('{')).toThrow('JSON 형식');
    expect(() => parseKaraokeShareBundle({ ...bundle, version: 99 })).toThrow('지원하지 않는 공유 데이터');
    expect(() => parseKaraokeShareBundle({ ...bundle, exportedAt: 'not-a-date' })).toThrow('생성 시간이 올바르지');
    expect(() => parseKaraokeShareBundle({ ...bundle, scope: null })).toThrow('공유 범위가 올바르지');
    expect(() => parseKaraokeShareBundle({ ...bundle, scope: { kind: 'future' } })).toThrow('지원하지 않는 공유 범위');
    expect(() => parseKaraokeShareText(JSON.stringify({ ...bundle, exportedAt: 'not-a-date' }))).toThrow(
      '생성 시간이 올바르지'
    );
    expect(() =>
      parseKaraokeShareBundle({
        ...bundle,
        lyrics: sampleLyrics,
      })
    ).toThrow('공유 범위 밖의 가사');

    const playlistBundle = createKaraokeShareBundle({
      library,
      kind: 'playlist',
      playlistId: 'vaundy',
      songSlug: 'kaiju-no-hanauta',
    });
    if (playlistBundle.scope.kind !== 'playlist') throw new Error('playlist fixture expected');
    const playlistScope = playlistBundle.scope;
    expect(() =>
      parseKaraokeShareBundle({
        ...playlistBundle,
        scope: {
          ...playlistScope,
          songs: [...playlistScope.songs, library.songs.find(song => song.slug === 'fujii-kaze-kirari')],
        },
      })
    ).toThrow('목록 밖의 곡');

    const libraryBundle = createKaraokeShareBundle({
      library,
      kind: 'library',
      playlistId: 'vaundy',
      songSlug: 'kaiju-no-hanauta',
    });
    if (libraryBundle.scope.kind !== 'library') throw new Error('library fixture expected');
    const libraryScope = libraryBundle.scope;
    expect(() =>
      parseKaraokeShareBundle({
        ...libraryBundle,
        scope: {
          kind: 'library',
          library: {
            ...libraryScope.library,
            schemaVersion: SONG_LIBRARY_SCHEMA_VERSION - 1,
          },
        },
      })
    ).toThrow('보관함 버전');
  });

  it('enforces array and text limits on the shared library', () => {
    const library = createDefaultSongLibrary();
    const bundle = createKaraokeShareBundle({
      library,
      kind: 'library',
      playlistId: 'vaundy',
      songSlug: 'kaiju-no-hanauta',
    });
    if (bundle.scope.kind !== 'library') throw new Error('library fixture expected');
    const scope = bundle.scope;

    expect(() => parseKaraokeShareBundle({ ...bundle, scope: { kind: 'library', library: null } })).toThrow(
      '곡 보관함 형식이 올바르지'
    );
    expect(() =>
      parseKaraokeShareBundle({ ...bundle, scope: { kind: 'library', library: { ...scope.library, songs: 'nope' } } })
    ).toThrow('곡 형식이 올바르지');
    expect(() =>
      parseKaraokeShareBundle({
        ...bundle,
        scope: {
          kind: 'library',
          library: { ...scope.library, playlists: Array.from({ length: 101 }, () => scope.library.playlists[0]) },
        },
      })
    ).toThrow('재생목록 수가 너무 많습니다');
    expect(() =>
      parseKaraokeShareBundle({
        ...bundle,
        scope: {
          kind: 'library',
          library: {
            ...scope.library,
            playlists: [{ ...scope.library.playlists[0]!, name: 'x'.repeat(241) }],
          },
        },
      })
    ).toThrow('재생목록 이름이 너무 깁니다');
    expect(() =>
      parseKaraokeShareBundle({
        ...bundle,
        scope: {
          kind: 'library',
          library: {
            ...scope.library,
            songs: [{ ...scope.library.songs[0]!, titleKo: 'x'.repeat(241) }],
            playlists: [{ ...scope.library.playlists[0]!, songSlugs: [scope.library.songs[0]!.slug] }],
          },
        },
      })
    ).toThrow('한국어 제목이 너무 깁니다');
  });

  it('rejects shared lyrics without a song id', () => {
    const library = createDefaultSongLibrary();
    const bundle = createKaraokeShareBundle({
      library,
      kind: 'song',
      playlistId: 'vaundy',
      songSlug: 'kaiju-no-hanauta',
    });
    expect(() => parseKaraokeShareBundle({ ...bundle, lyrics: 'nope' })).toThrow('가사 형식이 올바르지');
    expect(parseKaraokeShareBundle({ ...bundle, lyrics: [] }).lyrics).toEqual([]);
  });
});

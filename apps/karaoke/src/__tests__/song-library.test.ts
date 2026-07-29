import { describe, expect, it } from 'vitest';

import {
  addPlaylist,
  createDefaultSongLibrary,
  deletePlaylist,
  FUJII_KAZE_PLAYLIST_ID,
  parseSongLibrary,
  parseYouTubeVideoId,
  removeSongFromPlaylist,
  renamePlaylist,
  reorderPlaylistSongs,
  resolvePlayback,
  saveSongToPlaylist,
  songsInPlaylist,
  updateSongDetails,
} from '../lib/song-library';

describe('song library', () => {
  it('seeds the Fujii Kaze playlist with ten official videos', () => {
    const library = createDefaultSongLibrary();
    const songs = songsInPlaylist(library, FUJII_KAZE_PLAYLIST_ID);

    expect(library.playlists.map(playlist => playlist.name)).toEqual(['Vaundy', 'Fujii Kaze']);
    expect(songs.map(song => song.titleJa)).toEqual([
      'まつり',
      "Workin' Hard",
      '何なんw',
      'きらり',
      '花',
      'ガーデン',
      'damn',
      '死ぬのがいいわ',
      '旅路',
      '満ちてゆく',
    ]);
    expect(new Set(songs.map(song => song.videoId)).size).toBe(10);
  });

  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=12', 'dQw4w9WgXcQ'],
    ['https://youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://example.com/watch?v=dQw4w9WgXcQ', null],
    ['not a url', null],
  ])('reads a supported YouTube URL: %s', (url, expected) => {
    expect(parseYouTubeVideoId(url)).toBe(expected);
  });

  it('falls back when stored metadata is malformed or collides', () => {
    const duplicate = createDefaultSongLibrary();
    duplicate.songs[1] = { ...duplicate.songs[1]!, videoId: duplicate.songs[0]!.videoId };
    const developmentSnapshot = {
      ...createDefaultSongLibrary(),
      schemaVersion: 1,
      playlists: [createDefaultSongLibrary().playlists[0]!],
    };

    expect(parseSongLibrary({ nope: true })).toEqual(createDefaultSongLibrary());
    expect(parseSongLibrary(duplicate)).toEqual(createDefaultSongLibrary());
    expect(parseSongLibrary(developmentSnapshot)).toEqual(createDefaultSongLibrary());
  });

  it('creates, renames, and removes a playlist while keeping one playable list', () => {
    const original = createDefaultSongLibrary();
    const added = addPlaylist(original, 'favorites', '즐겨찾기');
    const renamed = renamePlaylist(added, 'favorites', 'Favorites');

    expect(renamed.playlists.at(-1)).toMatchObject({ id: 'favorites', name: 'Favorites', songSlugs: [] });
    expect(deletePlaylist(renamed, 'favorites').playlists).toHaveLength(2);
    expect(() => deletePlaylist({ ...original, playlists: [original.playlists[0]!] }, 'vaundy')).toThrow(
      '재생할 곡이 하나 이상'
    );
  });

  it('adds one video globally, reuses it in another playlist, and edits both references together', () => {
    const first = saveSongToPlaylist(
      createDefaultSongLibrary(),
      FUJII_KAZE_PLAYLIST_ID,
      'https://youtu.be/dQw4w9WgXcQ',
      {
        titleJa: 'テスト',
        titleKo: '테스트',
      }
    );
    const secondPlaylist = addPlaylist(first.library, 'favorites', '즐겨찾기');
    const reused = saveSongToPlaylist(secondPlaylist, 'favorites', 'https://youtube.com/watch?v=dQw4w9WgXcQ', {
      titleJa: 'きらり',
      titleKo: '키라리 수정',
    });

    expect(reused.library.songs.filter(song => song.videoId === 'dQw4w9WgXcQ')).toHaveLength(1);
    expect(songsInPlaylist(reused.library, 'favorites')[0]).toMatchObject({ titleKo: '키라리 수정' });
    expect(songsInPlaylist(reused.library, FUJII_KAZE_PLAYLIST_ID).at(-1)).toMatchObject({ titleKo: '키라리 수정' });
    expect(() =>
      saveSongToPlaylist(reused.library, 'favorites', 'https://youtu.be/dQw4w9WgXcQ', {
        titleJa: 'きらり',
        titleKo: '키라리',
      })
    ).toThrow('이미 이 재생목록');
  });

  it('edits, reorders, removes, and resolves playback from playlist state', () => {
    const original = createDefaultSongLibrary();
    const orderedSongs = songsInPlaylist(original, 'vaundy').toReversed();
    const reordered = reorderPlaylistSongs(original, 'vaundy', orderedSongs);
    const edited = updateSongDetails(reordered, orderedSongs[0]!.slug, {
      titleJa: '수정 원어',
      titleKo: '수정 한국어',
    });
    const removed = removeSongFromPlaylist(edited, 'vaundy', orderedSongs[1]!.slug);
    const playback = resolvePlayback(removed, 'missing', 'missing');

    expect(songsInPlaylist(edited, 'vaundy')[0]).toMatchObject({ titleJa: '수정 원어' });
    expect(songsInPlaylist(removed, 'vaundy')).not.toContainEqual(
      expect.objectContaining({ slug: orderedSongs[1]!.slug })
    );
    expect(playback.playlist.id).toBe('vaundy');
    expect(playback.song.slug).toBe(orderedSongs[0]!.slug);
  });

  it('rejects mutations when their playlist or song target is missing', () => {
    const library = createDefaultSongLibrary();

    expect(() => renamePlaylist(library, 'missing', '새 이름')).toThrow('수정할 재생목록');
    expect(() =>
      saveSongToPlaylist(library, 'missing', 'https://youtu.be/dQw4w9WgXcQ', {
        titleJa: 'きらり',
        titleKo: '키라리',
      })
    ).toThrow('곡을 추가할 재생목록');
    expect(() => updateSongDetails(library, 'missing', { titleJa: 'きらり', titleKo: '키라리' })).toThrow('수정할 곡');
    expect(() => removeSongFromPlaylist(library, 'missing', 'missing')).toThrow('재생목록에서 곡');
  });
});

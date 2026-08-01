import { describe, expect, it } from 'vitest';

import { createKaraokeShareBundle, parseKaraokeShareBundle } from '../lib/share/bundle';
import { createShareImportPlan } from '../lib/share/import-plan';
import { createDefaultSongLibrary } from '../lib/song-library';

describe('karaoke share import plan', () => {
  it('upserts one shared song into the current playlist', () => {
    const current = createDefaultSongLibrary();
    const incoming = parseKaraokeShareBundle({
      format: 'mumak-karaoke-share',
      version: 1,
      exportedAt: new Date().toISOString(),
      scope: {
        kind: 'song',
        song: {
          slug: 'youtube-dQw4w9WgXcQ',
          titleJa: '新しい歌',
          titleKo: '새 노래',
          videoId: 'dQw4w9WgXcQ',
        },
      },
      lyrics: [],
    });
    const plan = createShareImportPlan(current, incoming, 'vaundy');

    expect(plan.library.playlists[0]!.songSlugs.at(-1)).toBe('youtube-dQw4w9WgXcQ');
    expect(plan.summary).toMatchObject({
      kind: 'song',
      songCount: 1,
      lyricCount: 0,
      includesLyrics: true,
      newSongCount: 1,
    });
    expect(() => createShareImportPlan(current, incoming, 'missing-playlist')).toThrow(
      '담을 재생목록을 찾을 수 없습니다'
    );
  });

  it('replaces one matching playlist while preserving the rest of the library', () => {
    const current = createDefaultSongLibrary();
    const changed = structuredClone(current);
    changed.playlists[0]!.name = '새 Vaundy 순서';
    changed.playlists[0]!.songSlugs.reverse();
    changed.songs[0]!.titleKo = '수정된 제목';
    const incoming = createKaraokeShareBundle({
      library: changed,
      kind: 'playlist',
      playlistId: 'vaundy',
      songSlug: changed.playlists[0]!.songSlugs[0]!,
    });
    const plan = createShareImportPlan(current, incoming, 'vaundy');

    expect(plan.library.playlists).toHaveLength(current.playlists.length);
    expect(plan.library.playlists[0]!.name).toBe('새 Vaundy 순서');
    expect(plan.library.playlists[1]).toEqual(current.playlists[1]);
    expect(plan.summary).toMatchObject({
      changedSongCount: 1,
      changedPlaylistCount: 1,
      removedSongCount: 0,
      removedPlaylistCount: 0,
    });

    changed.playlists[0] = { ...changed.playlists[0]!, id: 'shared-vaundy' };
    const added = createKaraokeShareBundle({
      library: changed,
      kind: 'playlist',
      playlistId: 'shared-vaundy',
      songSlug: changed.playlists[0]!.songSlugs[0]!,
    });
    expect(createShareImportPlan(current, added, 'vaundy').library.playlists.at(-1)?.id).toBe('shared-vaundy');
  });

  it('plans a full replacement and rejects slug or video collisions', () => {
    const current = createDefaultSongLibrary();
    const replacement = structuredClone(current);
    replacement.playlists = [replacement.playlists[0]!];
    replacement.songs[0]!.videoId = 'dQw4w9WgXcQ';
    const full = createKaraokeShareBundle({
      library: replacement,
      kind: 'library',
      playlistId: 'vaundy',
      songSlug: 'kaiju-no-hanauta',
    });
    const replacementPlan = createShareImportPlan(current, full, 'vaundy');
    expect(replacementPlan.summary.removedPlaylistCount).toBe(1);
    expect(replacementPlan.library.songs[0]!.videoId).toBe('dQw4w9WgXcQ');

    const conflicting = parseKaraokeShareBundle({
      format: 'mumak-karaoke-share',
      version: 1,
      exportedAt: new Date().toISOString(),
      scope: {
        kind: 'song',
        song: { ...current.songs[0], videoId: 'dQw4w9WgXcQ' },
      },
    });
    expect(() => createShareImportPlan(current, conflicting, 'vaundy')).toThrow('다른 영상과 연결');

    const videoCollision = parseKaraokeShareBundle({
      format: 'mumak-karaoke-share',
      version: 1,
      exportedAt: new Date().toISOString(),
      scope: {
        kind: 'song',
        song: { ...current.songs[0], slug: 'different-slug' },
      },
    });
    expect(() => createShareImportPlan(current, videoCollision, 'vaundy')).toThrow('다른 곡 ID');
  });
});

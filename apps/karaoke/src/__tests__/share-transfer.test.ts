import { describe, expect, it, vi } from 'vitest';

import type { StoredLyricsEntry } from '../lib/lyrics-import';
import {
  createKaraokeShareBundle,
  createShareImportPlan,
  encodeKaraokeShareFrames,
  KaraokeShareFrameCollector,
  parseKaraokeShareBundle,
  parseKaraokeShareText,
  serializeKaraokeShareBundle,
} from '../lib/share-transfer';
import { createDefaultSongLibrary, SONG_LIBRARY_SCHEMA_VERSION } from '../lib/song-library';

const sampleLyrics: StoredLyricsEntry[] = [
  {
    slug: 'kaiju-no-hanauta',
    lyrics: [
      { time: 0, jp: '思い出すのは', pron: '오모이다스노와', ko: '떠올리는 것은' },
      { time: 4.2, jp: '君の歌', pron: '키미노 우타', ko: '너의 노래' },
    ],
  },
  {
    slug: 'fujii-kaze-kirari',
    lyrics: [{ time: 0, jp: '荒れ狂う季節の中を', pron: '아레쿠루우 키세츠노 나카오', ko: '거친 계절 속을' }],
  },
];

describe('karaoke share transfer', () => {
  it('filters lyrics to the selected scope and restores shuffled QR frames', async () => {
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

    const frames = await encodeKaraokeShareFrames(bundle);
    const collector = new KaraokeShareFrameCollector();
    expect(frames.length).toBeGreaterThan(1);
    for (const frame of frames.toReversed()) collector.add(frame);
    expect(collector.add(frames[0]!)).toMatchObject({ accepted: true, added: false });
    expect(collector.complete).toBe(true);
    expect(await collector.decode()).toEqual(bundle);
  });

  it('ignores another transfer, rejects a conflicting duplicate, and resets cleanly', async () => {
    const library = createDefaultSongLibrary();
    const first = await encodeKaraokeShareFrames(
      createKaraokeShareBundle({
        library,
        kind: 'playlist',
        playlistId: 'vaundy',
        songSlug: 'kaiju-no-hanauta',
      })
    );
    const second = await encodeKaraokeShareFrames(
      createKaraokeShareBundle({
        library,
        kind: 'song',
        playlistId: 'vaundy',
        songSlug: 'odoriko',
      })
    );
    const collector = new KaraokeShareFrameCollector();

    collector.add(first[0]!);
    expect(collector.add(second[0]!)).toMatchObject({ accepted: false, added: false });

    const parts = first[0]!.split('|');
    const payload = parts[4]!;
    parts[4] = `${payload[0] === 'A' ? 'B' : 'A'}${payload.slice(1)}`;
    expect(() => collector.add(parts.join('|'))).toThrow('내용이 서로 다릅니다');
    await expect(collector.decode()).rejects.toThrow('아직 받지 못한');

    collector.reset();
    expect(collector.received).toBe(0);
    expect(collector.total).toBe(0);
    expect(collector.complete).toBe(false);

    const tamperedFrames = [...first];
    const tamperedParts = tamperedFrames[0]!.split('|');
    const tamperedPayload = tamperedParts[4]!;
    tamperedParts[4] = `${tamperedPayload[0] === 'A' ? 'B' : 'A'}${tamperedPayload.slice(1)}`;
    tamperedFrames[0] = tamperedParts.join('|');
    const tamperedCollector = new KaraokeShareFrameCollector();
    for (const frame of tamperedFrames) tamperedCollector.add(frame);
    await expect(tamperedCollector.decode()).rejects.toThrow('무결성');

    const oversizedParts = first[0]!.split('|');
    oversizedParts[3] = (701).toString(36);
    expect(() => new KaraokeShareFrameCollector().add(oversizedParts.join('|'))).toThrow('조각 번호');
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

  it('rejects malformed QR payloads and browsers without decompression support', async () => {
    const malformedBase64 = 'MK1|abcdefghijklmnop|0|1|A';
    expect(() => new KaraokeShareFrameCollector().add(malformedBase64)).toThrow('QR 조각을 읽을 수 없습니다');
    expect(() => new KaraokeShareFrameCollector().add('MK1|abcdefghijklmnop|0|2|AQ')).toThrow('데이터 길이가 올바르지');

    const library = createDefaultSongLibrary();
    const frames = await encodeKaraokeShareFrames(
      createKaraokeShareBundle({
        library,
        kind: 'song',
        playlistId: 'vaundy',
        songSlug: 'kaiju-no-hanauta',
      })
    );
    const collector = new KaraokeShareFrameCollector();
    for (const frame of frames) collector.add(frame);
    vi.stubGlobal('DecompressionStream', undefined);
    await expect(collector.decode()).rejects.toThrow('압축을 지원하지 않습니다');
    vi.unstubAllGlobals();
  });

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

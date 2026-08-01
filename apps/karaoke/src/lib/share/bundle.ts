import {
  LYRICS_BACKUP_SCHEMA_VERSION,
  MAX_LYRICS_BACKUP_SIZE,
  MAX_LYRICS_LIBRARY_SONGS,
  parseLyricsImportFile,
  type StoredLyricsEntry,
} from '@/lib/lyrics-import';
import {
  parseSongLibraryStrict,
  SONG_LIBRARY_SCHEMA_VERSION,
  type Playlist,
  type SongLibrary,
} from '@/lib/song-library';
import type { Song } from '@/songs';

const SHARE_FORMAT = 'mumak-karaoke-share';
const SHARE_VERSION = 1;
const MAX_SONGS = 1_000;
const MAX_PLAYLISTS = 100;
const MAX_SONGS_PER_PLAYLIST = 1_000;
const MAX_ID_LENGTH = 160;
const MAX_TITLE_LENGTH = 240;

export const MAX_SHARE_FILE_BYTES = MAX_LYRICS_BACKUP_SIZE;

export type ShareScopeKind = 'song' | 'playlist' | 'library';

export type KaraokeShareBundle = {
  format: typeof SHARE_FORMAT;
  version: typeof SHARE_VERSION;
  exportedAt: string;
  scope:
    | { kind: 'song'; song: Song }
    | { kind: 'playlist'; playlist: Playlist; songs: Song[] }
    | { kind: 'library'; library: SongLibrary };
  lyrics?: StoredLyricsEntry[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function assertArrayLimit(value: unknown, limit: number, label: string): asserts value is unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} 형식이 올바르지 않습니다.`);
  if (value.length > limit) throw new Error(`${label} 수가 너무 많습니다.`);
}

function assertTextLimit(value: string, limit: number, label: string) {
  if (value.length > limit) throw new Error(`${label}이 너무 깁니다.`);
}

function parseBoundedLibrary(value: unknown): SongLibrary {
  if (!isRecord(value)) throw new Error('곡 보관함 형식이 올바르지 않습니다.');
  if (value.schemaVersion !== SONG_LIBRARY_SCHEMA_VERSION) {
    throw new Error('지원하지 않는 곡 보관함 버전입니다.');
  }
  assertArrayLimit(value.songs, MAX_SONGS, '곡');
  assertArrayLimit(value.playlists, MAX_PLAYLISTS, '재생목록');
  for (const candidate of value.playlists) {
    if (isRecord(candidate)) assertArrayLimit(candidate.songSlugs, MAX_SONGS_PER_PLAYLIST, '재생목록의 곡');
  }

  const library = parseSongLibraryStrict(value);
  for (const song of library.songs) {
    assertTextLimit(song.slug, MAX_ID_LENGTH, '곡 ID');
    assertTextLimit(song.titleJa, MAX_TITLE_LENGTH, '원어 제목');
    assertTextLimit(song.titleKo, MAX_TITLE_LENGTH, '한국어 제목');
  }
  for (const playlist of library.playlists) {
    assertTextLimit(playlist.id, MAX_ID_LENGTH, '재생목록 ID');
    assertTextLimit(playlist.name, MAX_TITLE_LENGTH, '재생목록 이름');
  }
  return library;
}

function parseSharedLyrics(value: unknown, allowedSlugs: ReadonlySet<string>): StoredLyricsEntry[] | undefined {
  if (value === undefined) return undefined;
  assertArrayLimit(value, MAX_LYRICS_LIBRARY_SONGS, '가사');
  if (value.length === 0) return [];

  const entries = parseLyricsImportFile({
    schemaVersion: LYRICS_BACKUP_SCHEMA_VERSION,
    songs: value,
  }).map(entry => {
    if (!entry.slug) throw new Error('공유 가사에 곡 ID가 없습니다.');
    if (!allowedSlugs.has(entry.slug)) throw new Error('공유 범위 밖의 가사가 들어 있습니다.');
    return { slug: entry.slug, lyrics: entry.lyrics };
  });
  return entries;
}

export function parseKaraokeShareBundle(value: unknown): KaraokeShareBundle {
  if (!isRecord(value) || value.format !== SHARE_FORMAT || value.version !== SHARE_VERSION) {
    throw new Error('지원하지 않는 공유 데이터입니다.');
  }
  if (
    typeof value.exportedAt !== 'string' ||
    value.exportedAt.length > 40 ||
    !Number.isFinite(Date.parse(value.exportedAt))
  ) {
    throw new Error('공유 데이터의 생성 시간이 올바르지 않습니다.');
  }
  if (!isRecord(value.scope) || typeof value.scope.kind !== 'string') {
    throw new Error('공유 범위가 올바르지 않습니다.');
  }

  let scope: KaraokeShareBundle['scope'];
  let allowedSlugs: Set<string>;
  if (value.scope.kind === 'library') {
    const library = parseBoundedLibrary(value.scope.library);
    scope = { kind: 'library', library };
    allowedSlugs = new Set(library.songs.map(song => song.slug));
  } else if (value.scope.kind === 'playlist') {
    const library = parseBoundedLibrary({
      schemaVersion: SONG_LIBRARY_SCHEMA_VERSION,
      songs: value.scope.songs,
      playlists: [value.scope.playlist],
    });
    const playlist = library.playlists[0]!;
    const referencedSlugs = new Set(playlist.songSlugs);
    if (library.songs.length !== referencedSlugs.size || library.songs.some(song => !referencedSlugs.has(song.slug))) {
      throw new Error('재생목록 공유에 목록 밖의 곡이 들어 있습니다.');
    }
    scope = { kind: 'playlist', playlist, songs: library.songs };
    allowedSlugs = referencedSlugs;
  } else if (value.scope.kind === 'song') {
    const candidate = value.scope.song;
    const slug = isRecord(candidate) && typeof candidate.slug === 'string' ? candidate.slug : '';
    const library = parseBoundedLibrary({
      schemaVersion: SONG_LIBRARY_SCHEMA_VERSION,
      songs: [candidate],
      playlists: [{ id: 'shared-song', name: '공유 곡', songSlugs: [slug] }],
    });
    scope = { kind: 'song', song: library.songs[0]! };
    allowedSlugs = new Set([library.songs[0]!.slug]);
  } else {
    throw new Error('지원하지 않는 공유 범위입니다.');
  }

  const lyrics = parseSharedLyrics(value.lyrics, allowedSlugs);
  return {
    format: SHARE_FORMAT,
    version: SHARE_VERSION,
    exportedAt: value.exportedAt,
    scope,
    ...(lyrics === undefined ? {} : { lyrics }),
  };
}

export function createKaraokeShareBundle({
  library,
  kind,
  playlistId,
  songSlug,
  lyrics,
}: {
  library: SongLibrary;
  kind: ShareScopeKind;
  playlistId: string;
  songSlug: string;
  lyrics?: readonly StoredLyricsEntry[];
}): KaraokeShareBundle {
  let scope: KaraokeShareBundle['scope'];
  let allowedSlugs: Set<string>;
  if (kind === 'library') {
    scope = { kind, library };
    allowedSlugs = new Set(library.songs.map(song => song.slug));
  } else if (kind === 'playlist') {
    const playlist = library.playlists.find(candidate => candidate.id === playlistId);
    if (!playlist) throw new Error('공유할 재생목록을 찾을 수 없습니다.');
    const songsBySlug = new Map(library.songs.map(song => [song.slug, song]));
    const songs = playlist.songSlugs.map(slug => songsBySlug.get(slug)).filter((song): song is Song => Boolean(song));
    scope = { kind, playlist, songs };
    allowedSlugs = new Set(playlist.songSlugs);
  } else {
    const song = library.songs.find(candidate => candidate.slug === songSlug);
    if (!song) throw new Error('공유할 곡을 찾을 수 없습니다.');
    scope = { kind, song };
    allowedSlugs = new Set([song.slug]);
  }

  return parseKaraokeShareBundle({
    format: SHARE_FORMAT,
    version: SHARE_VERSION,
    exportedAt: new Date().toISOString(),
    scope,
    ...(lyrics === undefined
      ? {}
      : {
          lyrics: lyrics.filter(entry => allowedSlugs.has(entry.slug)),
        }),
  });
}

export function serializeKaraokeShareBundle(bundle: KaraokeShareBundle): string {
  const serialized = JSON.stringify(parseKaraokeShareBundle(bundle));
  if (new TextEncoder().encode(serialized).byteLength > MAX_SHARE_FILE_BYTES) {
    throw new Error('공유 데이터는 24MB까지 만들 수 있습니다.');
  }
  return serialized;
}

export function parseKaraokeShareText(text: string): KaraokeShareBundle {
  if (text.length > MAX_SHARE_FILE_BYTES || new TextEncoder().encode(text).byteLength > MAX_SHARE_FILE_BYTES) {
    throw new Error('공유 파일은 24MB까지 불러올 수 있습니다.');
  }
  try {
    return parseKaraokeShareBundle(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('공유 파일의 JSON 형식이 올바르지 않습니다.', { cause: error });
    }
    throw error;
  }
}

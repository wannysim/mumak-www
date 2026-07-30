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
const FRAME_PREFIX = 'MK2';
const FRAME_CHUNK_BYTES = 512;
const LEGACY_FRAME_CHUNK_BYTES = 192;
const MAX_FRAME_COUNT = 700;
const DIGEST_BYTES = 12;
// RFC 9285 keeps binary payloads in QR Alphanumeric mode: https://www.rfc-editor.org/rfc/rfc9285.html#section-4
const BASE45_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const MAX_SONGS = 1_000;
const MAX_PLAYLISTS = 100;
const MAX_SONGS_PER_PLAYLIST = 1_000;
const MAX_ID_LENGTH = 160;
const MAX_TITLE_LENGTH = 240;

// ponytail: optical QR transfer is capped at about 350 KiB compressed; add a
// temporary relay only if real libraries outgrow the included share-file fallback.
export const MAX_QR_SHARE_BYTES = FRAME_CHUNK_BYTES * MAX_FRAME_COUNT;
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

export type ShareImportPlan = {
  library: SongLibrary;
  summary: {
    kind: ShareScopeKind;
    songCount: number;
    playlistCount: number;
    lyricCount: number;
    includesLyrics: boolean;
    newSongCount: number;
    changedSongCount: number;
    newPlaylistCount: number;
    changedPlaylistCount: number;
    removedSongCount: number;
    removedPlaylistCount: number;
  };
};

type ParsedFrame = {
  version: 1 | 2;
  id: string;
  index: number;
  total: number;
  chunk: Uint8Array;
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

function concatBytes(chunks: readonly Uint8Array[], total: number): Uint8Array {
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

async function readStreamWithLimit(
  stream: ReadableStream<Uint8Array>,
  limit: number,
  tooLargeMessage: string
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new Error(tooLargeMessage);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return concatBytes(chunks, total);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[\w-]+$/u.test(value)) throw new Error('QR 조각의 문자 형식이 올바르지 않습니다.');
  const padded = value
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  let decoded: string;
  try {
    decoded = atob(padded);
  } catch {
    throw new Error('QR 조각을 읽을 수 없습니다.');
  }
  return Uint8Array.from(decoded, character => character.charCodeAt(0));
}

function bytesToBase45(bytes: Uint8Array): string {
  let encoded = '';
  for (let index = 0; index < bytes.length; index += 2) {
    const first = bytes[index]!;
    if (index + 1 === bytes.length) {
      encoded += BASE45_ALPHABET[first % 45]! + BASE45_ALPHABET[Math.floor(first / 45)]!;
      break;
    }

    const value = first * 256 + bytes[index + 1]!;
    encoded +=
      BASE45_ALPHABET[value % 45]! +
      BASE45_ALPHABET[Math.floor(value / 45) % 45]! +
      BASE45_ALPHABET[Math.floor(value / 45 ** 2)]!;
  }
  return encoded;
}

function base45ToBytes(value: string): Uint8Array {
  if (!value || value.length % 3 === 1) throw new Error('QR 조각의 문자 형식이 올바르지 않습니다.');
  const decoded = new Uint8Array(Math.floor(value.length / 3) * 2 + (value.length % 3 === 2 ? 1 : 0));
  let decodedIndex = 0;

  for (let index = 0; index < value.length; index += 3) {
    const groupLength = Math.min(3, value.length - index);
    const digits = Array.from({ length: groupLength }, (_, offset) => BASE45_ALPHABET.indexOf(value[index + offset]!));
    if (digits.some(digit => digit < 0)) throw new Error('QR 조각의 문자 형식이 올바르지 않습니다.');
    const number = digits[0]! + digits[1]! * 45 + (digits[2] ?? 0) * 45 ** 2;
    if (number > (groupLength === 3 ? 65_535 : 255)) throw new Error('QR 조각을 읽을 수 없습니다.');

    if (groupLength === 3) decoded[decodedIndex++] = Math.floor(number / 256);
    decoded[decodedIndex++] = number % 256;
  }
  return decoded;
}

function ownedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

async function digestId(bytes: Uint8Array, version: 1 | 2): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', ownedArrayBuffer(bytes)));
  const truncated = digest.subarray(0, DIGEST_BYTES);
  return version === 1
    ? bytesToBase64Url(truncated)
    : Array.from(truncated, byte => byte.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
}

async function gzip(text: string): Promise<Uint8Array> {
  if (typeof CompressionStream !== 'function') {
    throw new Error('이 브라우저는 QR 공유 압축을 지원하지 않습니다. 공유 파일을 이용해 주세요.');
  }
  const stream = new Response(text).body?.pipeThrough(new CompressionStream('gzip'));
  if (!stream) throw new Error('공유 데이터를 압축하지 못했습니다.');
  return readStreamWithLimit(
    stream,
    MAX_QR_SHARE_BYTES,
    'QR로 보내기에는 데이터가 너무 큽니다. 공유 파일을 이용해 주세요.'
  );
}

async function gunzip(bytes: Uint8Array): Promise<string> {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('이 브라우저는 QR 공유 압축을 지원하지 않습니다. 공유 파일을 이용해 주세요.');
  }
  const stream = new Response(ownedArrayBuffer(bytes)).body?.pipeThrough(new DecompressionStream('gzip'));
  if (!stream) throw new Error('공유 데이터의 압축을 풀지 못했습니다.');
  const decompressed = await readStreamWithLimit(
    stream,
    MAX_SHARE_FILE_BYTES,
    '압축을 푼 공유 데이터가 24MB를 넘습니다.'
  );
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(decompressed);
  } catch {
    throw new Error('공유 데이터의 문자 형식이 올바르지 않습니다.');
  }
}

export async function encodeKaraokeShareFrames(bundle: KaraokeShareBundle): Promise<string[]> {
  const compressed = await gzip(serializeKaraokeShareBundle(bundle));
  const total = Math.ceil(compressed.byteLength / FRAME_CHUNK_BYTES);
  if (total === 0 || total > MAX_FRAME_COUNT) {
    throw new Error('QR로 보내기에는 데이터가 너무 큽니다. 공유 파일을 이용해 주세요.');
  }
  const id = await digestId(compressed, 2);
  return Array.from({ length: total }, (_, index) => {
    const chunk = compressed.subarray(index * FRAME_CHUNK_BYTES, (index + 1) * FRAME_CHUNK_BYTES);
    return `${FRAME_PREFIX}:${id}:${index.toString(36).toUpperCase()}:${total.toString(36).toUpperCase()}:${bytesToBase45(chunk)}`;
  });
}

function parseFrame(value: string): ParsedFrame {
  if (value.startsWith('MK1|')) return parseLegacyFrame(value);
  if (value.length > 820) throw new Error('QR 조각이 허용된 크기를 넘습니다.');
  const match = /^MK2:([0-9A-F]{24}):([0-9A-Z]{1,2}):([0-9A-Z]{1,2}):([-A-Z0-9 $%*+./:]+)$/u.exec(value);
  if (!match) throw new Error('이 앱에서 만든 공유 QR이 아닙니다.');
  const index = Number.parseInt(match[2]!, 36);
  const total = Number.parseInt(match[3]!, 36);
  if (!Number.isSafeInteger(index) || !Number.isSafeInteger(total) || total < 1 || total > MAX_FRAME_COUNT) {
    throw new Error('QR 조각 번호가 올바르지 않습니다.');
  }
  if (index < 0 || index >= total) throw new Error('QR 조각 순서가 올바르지 않습니다.');
  const chunk = base45ToBytes(match[4]!);
  const expectedLength =
    index === total - 1 ? { min: 1, max: FRAME_CHUNK_BYTES } : { min: FRAME_CHUNK_BYTES, max: FRAME_CHUNK_BYTES };
  if (chunk.byteLength < expectedLength.min || chunk.byteLength > expectedLength.max) {
    throw new Error('QR 조각의 데이터 길이가 올바르지 않습니다.');
  }
  return { version: 2, id: match[1]!, index, total, chunk };
}

function parseLegacyFrame(value: string): ParsedFrame {
  if (value.length > 320) throw new Error('QR 조각이 허용된 크기를 넘습니다.');
  const match = /^MK1\|([\w-]{16})\|([0-9a-z]{1,2})\|([0-9a-z]{1,2})\|([\w-]+)$/u.exec(value);
  if (!match) throw new Error('이 앱에서 만든 공유 QR이 아닙니다.');
  const index = Number.parseInt(match[2]!, 36);
  const total = Number.parseInt(match[3]!, 36);
  if (!Number.isSafeInteger(index) || !Number.isSafeInteger(total) || total < 1 || total > MAX_FRAME_COUNT) {
    throw new Error('QR 조각 번호가 올바르지 않습니다.');
  }
  if (index < 0 || index >= total) throw new Error('QR 조각 순서가 올바르지 않습니다.');
  const chunk = base64UrlToBytes(match[4]!);
  const expectedLength =
    index === total - 1
      ? { min: 1, max: LEGACY_FRAME_CHUNK_BYTES }
      : { min: LEGACY_FRAME_CHUNK_BYTES, max: LEGACY_FRAME_CHUNK_BYTES };
  if (chunk.byteLength < expectedLength.min || chunk.byteLength > expectedLength.max) {
    throw new Error('QR 조각의 데이터 길이가 올바르지 않습니다.');
  }
  return { version: 1, id: match[1]!, index, total, chunk };
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && left.every((value, index) => value === right[index]);
}

export class KaraokeShareFrameCollector {
  private version: 1 | 2 | null = null;
  private id: string | null = null;
  private expectedTotal = 0;
  private chunks = new Map<number, Uint8Array>();

  get received(): number {
    return this.chunks.size;
  }

  get total(): number {
    return this.expectedTotal;
  }

  get complete(): boolean {
    return this.expectedTotal > 0 && this.chunks.size === this.expectedTotal;
  }

  add(value: string): { accepted: boolean; added: boolean; received: number; total: number } {
    const frame = parseFrame(value);
    if (
      this.id !== null &&
      (frame.version !== this.version || frame.id !== this.id || frame.total !== this.expectedTotal)
    ) {
      return { accepted: false, added: false, received: this.received, total: this.total };
    }
    if (this.id === null) {
      this.version = frame.version;
      this.id = frame.id;
      this.expectedTotal = frame.total;
    }

    const existing = this.chunks.get(frame.index);
    if (existing && !sameBytes(existing, frame.chunk)) {
      throw new Error('같은 번호의 QR 조각 내용이 서로 다릅니다. 처음부터 다시 받아 주세요.');
    }
    if (!existing) this.chunks.set(frame.index, frame.chunk);
    return { accepted: true, added: !existing, received: this.received, total: this.total };
  }

  async decode(): Promise<KaraokeShareBundle> {
    if (!this.complete || !this.id || !this.version) throw new Error('아직 받지 못한 QR 조각이 있습니다.');
    const ordered = Array.from({ length: this.expectedTotal }, (_, index) => this.chunks.get(index)!);
    const compressed = concatBytes(
      ordered,
      ordered.reduce((total, chunk) => total + chunk.byteLength, 0)
    );
    if ((await digestId(compressed, this.version)) !== this.id) {
      throw new Error('QR 데이터의 무결성 검사를 통과하지 못했습니다.');
    }
    return parseKaraokeShareText(await gunzip(compressed));
  }

  reset() {
    this.version = null;
    this.id = null;
    this.expectedTotal = 0;
    this.chunks.clear();
  }
}

function songsFromBundle(bundle: KaraokeShareBundle): Song[] {
  if (bundle.scope.kind === 'library') return bundle.scope.library.songs;
  if (bundle.scope.kind === 'playlist') return bundle.scope.songs;
  return [bundle.scope.song];
}

function sameSong(left: Song, right: Song): boolean {
  return (
    left.slug === right.slug &&
    left.videoId === right.videoId &&
    left.titleJa === right.titleJa &&
    left.titleKo === right.titleKo
  );
}

function samePlaylist(left: Playlist, right: Playlist): boolean {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.songSlugs.length === right.songSlugs.length &&
    left.songSlugs.every((slug, index) => slug === right.songSlugs[index])
  );
}

function upsertSongs(current: readonly Song[], incoming: readonly Song[]): Song[] {
  const incomingBySlug = new Map(incoming.map(song => [song.slug, song]));
  const result = current.map(song => incomingBySlug.get(song.slug) ?? song);
  const currentSlugs = new Set(current.map(song => song.slug));
  result.push(...incoming.filter(song => !currentSlugs.has(song.slug)));
  return result;
}

export function createShareImportPlan(
  currentLibrary: SongLibrary,
  bundle: KaraokeShareBundle,
  targetPlaylistId: string
): ShareImportPlan {
  const current = parseSongLibraryStrict(currentLibrary);
  const incomingSongs = songsFromBundle(bundle);
  const currentBySlug = new Map(current.songs.map(song => [song.slug, song]));
  const currentByVideo = new Map(current.songs.map(song => [song.videoId, song]));
  if (bundle.scope.kind !== 'library') {
    for (const song of incomingSongs) {
      const slugMatch = currentBySlug.get(song.slug);
      const videoMatch = currentByVideo.get(song.videoId);
      if (slugMatch && slugMatch.videoId !== song.videoId) {
        throw new Error(`${song.slug} 곡 ID가 이 기기의 다른 영상과 연결되어 있습니다.`);
      }
      if (videoMatch && videoMatch.slug !== song.slug) {
        throw new Error(`${song.titleJa} 영상이 이 기기에서 다른 곡 ID로 저장되어 있습니다.`);
      }
    }
  }

  let library: SongLibrary;
  if (bundle.scope.kind === 'library') {
    library = bundle.scope.library;
  } else if (bundle.scope.kind === 'playlist') {
    const incomingPlaylist = bundle.scope.playlist;
    library = {
      schemaVersion: SONG_LIBRARY_SCHEMA_VERSION,
      songs: upsertSongs(current.songs, incomingSongs),
      playlists: current.playlists.some(playlist => playlist.id === incomingPlaylist.id)
        ? current.playlists.map(playlist => (playlist.id === incomingPlaylist.id ? incomingPlaylist : playlist))
        : [...current.playlists, incomingPlaylist],
    };
  } else {
    const target = current.playlists.find(playlist => playlist.id === targetPlaylistId);
    if (!target) throw new Error('공유 곡을 담을 재생목록을 찾을 수 없습니다.');
    const sharedSong = bundle.scope.song;
    library = {
      schemaVersion: SONG_LIBRARY_SCHEMA_VERSION,
      songs: upsertSongs(current.songs, incomingSongs),
      playlists: current.playlists.map(playlist =>
        playlist.id === target.id && !playlist.songSlugs.includes(sharedSong.slug)
          ? { ...playlist, songSlugs: [...playlist.songSlugs, sharedSong.slug] }
          : playlist
      ),
    };
  }
  library = parseSongLibraryStrict(library);

  const incomingPlaylists =
    bundle.scope.kind === 'library'
      ? bundle.scope.library.playlists
      : bundle.scope.kind === 'playlist'
        ? [bundle.scope.playlist]
        : [];
  const currentPlaylistById = new Map(current.playlists.map(playlist => [playlist.id, playlist]));
  const incomingSongSlugs = new Set(incomingSongs.map(song => song.slug));
  const incomingPlaylistIds = new Set(incomingPlaylists.map(playlist => playlist.id));
  return {
    library,
    summary: {
      kind: bundle.scope.kind,
      songCount: incomingSongs.length,
      playlistCount: incomingPlaylists.length,
      lyricCount: bundle.lyrics?.length ?? 0,
      includesLyrics: bundle.lyrics !== undefined,
      newSongCount: incomingSongs.filter(song => !currentBySlug.has(song.slug)).length,
      changedSongCount: incomingSongs.filter(song => {
        const stored = currentBySlug.get(song.slug);
        return stored ? !sameSong(stored, song) : false;
      }).length,
      newPlaylistCount: incomingPlaylists.filter(playlist => !currentPlaylistById.has(playlist.id)).length,
      changedPlaylistCount: incomingPlaylists.filter(playlist => {
        const stored = currentPlaylistById.get(playlist.id);
        return stored ? !samePlaylist(stored, playlist) : false;
      }).length,
      removedSongCount:
        bundle.scope.kind === 'library' ? current.songs.filter(song => !incomingSongSlugs.has(song.slug)).length : 0,
      removedPlaylistCount:
        bundle.scope.kind === 'library'
          ? current.playlists.filter(playlist => !incomingPlaylistIds.has(playlist.id)).length
          : 0,
    },
  };
}

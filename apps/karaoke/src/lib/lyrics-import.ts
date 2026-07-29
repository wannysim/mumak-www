import type { LyricLine } from '@/lib/lyrics';

const MAX_LYRIC_LINES = 5_000;
export const MAX_LYRICS_LIBRARY_SONGS = 50;
export const LYRICS_BACKUP_SCHEMA_VERSION = 1;
export const MAX_LYRICS_BACKUP_SIZE = 24 * 1024 * 1024;

type LyricsEnvelope = {
  slug?: unknown;
  lyrics?: unknown;
};

type LyricsLibraryBackup = {
  schemaVersion?: unknown;
  songs?: unknown;
};

export type ParsedLyricsFile = {
  slug?: string;
  lyrics: LyricLine[];
};

export type StoredLyricsEntry = {
  slug: string;
  lyrics: LyricLine[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseLine(value: unknown, index: number): LyricLine {
  if (!isRecord(value)) throw new Error(`${index + 1}번째 줄의 형식이 올바르지 않습니다.`);

  const { time, jp, pron = '', ko = '' } = value;
  if (typeof time !== 'number' || !Number.isFinite(time) || time < 0) {
    throw new Error(`${index + 1}번째 줄의 시간이 올바르지 않습니다.`);
  }
  if (typeof jp !== 'string' || jp.trim().length === 0) {
    throw new Error(`${index + 1}번째 줄에 일본어 원문이 없습니다.`);
  }
  if (typeof pron !== 'string' || typeof ko !== 'string') {
    throw new Error(`${index + 1}번째 줄의 발음 또는 번역 형식이 올바르지 않습니다.`);
  }

  return { time, jp: jp.trim(), pron: pron.trim(), ko: ko.trim() };
}

function parseLines(value: unknown): LyricLine[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('가사 줄이 들어 있는 JSON 배열이 필요합니다.');
  }
  if (value.length > MAX_LYRIC_LINES) {
    throw new Error(`한 곡은 ${MAX_LYRIC_LINES.toLocaleString()}줄까지 불러올 수 있습니다.`);
  }

  const lines = value.map(parseLine);
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]!.time <= lines[index - 1]!.time) {
      throw new Error(`${index + 1}번째 줄의 시간은 이전 줄보다 커야 합니다.`);
    }
  }
  return lines;
}

export function parseLyricsFile(value: unknown): ParsedLyricsFile {
  if (Array.isArray(value)) return { lyrics: parseLines(value) };
  if (!isRecord(value)) throw new Error('지원하지 않는 JSON 형식입니다.');

  const envelope = value as LyricsEnvelope;
  const slug = typeof envelope.slug === 'string' && envelope.slug.trim() ? envelope.slug.trim() : undefined;
  return { slug, lyrics: parseLines(envelope.lyrics) };
}

/**
 * 한 곡 JSON뿐 아니라 앱이 내보낸 전체 라이브러리 백업도 읽는다.
 * 단일 파일 이름에서 slug를 추론하는 일은 UI 계층에서만 수행한다.
 */
export function parseLyricsImportFile(value: unknown): ParsedLyricsFile[] {
  if (!isRecord(value) || !('songs' in value)) return [parseLyricsFile(value)];

  const backup = value as LyricsLibraryBackup;
  if (backup.schemaVersion !== LYRICS_BACKUP_SCHEMA_VERSION) {
    throw new Error('지원하지 않는 가사 백업 버전입니다.');
  }
  if (!Array.isArray(backup.songs) || backup.songs.length === 0) {
    throw new Error('가사 백업에 곡이 없습니다.');
  }
  if (backup.songs.length > MAX_LYRICS_LIBRARY_SONGS) {
    throw new Error(`한 백업은 ${MAX_LYRICS_LIBRARY_SONGS}곡까지 불러올 수 있습니다.`);
  }

  const songs = backup.songs.map((song, index) => {
    const parsed = parseLyricsFile(song);
    if (!parsed.slug) throw new Error(`백업의 ${index + 1}번째 곡에 slug가 없습니다.`);
    return parsed;
  });
  if (new Set(songs.map(song => song.slug)).size !== songs.length) {
    throw new Error('백업에 같은 곡이 두 번 들어 있습니다.');
  }
  return songs;
}

export function isLyricsLibraryBackup(value: unknown): boolean {
  return isRecord(value) && 'songs' in value;
}

export function createLyricsLibraryBackup(entries: readonly StoredLyricsEntry[]) {
  if (entries.length > MAX_LYRICS_LIBRARY_SONGS) {
    throw new Error(`한 백업은 ${MAX_LYRICS_LIBRARY_SONGS}곡까지 저장할 수 있습니다.`);
  }

  return {
    schemaVersion: LYRICS_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    songs: entries,
  };
}

export function serializeLyricsLibraryBackup(entries: readonly StoredLyricsEntry[]): string {
  const serialized = JSON.stringify(createLyricsLibraryBackup(entries), null, 2);
  if (new TextEncoder().encode(serialized).byteLength > MAX_LYRICS_BACKUP_SIZE) {
    throw new Error('전체 백업이 24MB보다 큽니다. 곡 수나 가사 길이를 줄인 뒤 다시 시도해 주세요.');
  }
  return serialized;
}

export function slugFromFileName(fileName: string): string {
  return fileName.replace(/\.json$/i, '').trim();
}

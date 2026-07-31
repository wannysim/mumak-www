import { describe, expect, it } from 'vitest';

import {
  createLyricsLibraryBackup,
  LYRICS_BACKUP_SCHEMA_VERSION,
  MAX_LYRICS_LIBRARY_SONGS,
  parseLyricsFile,
  parseLyricsImportFile,
  serializeLyricsLibraryBackup,
  slugFromFileName,
} from '../lib/lyrics-import';

describe('parseLyricsFile', () => {
  it('accepts the existing lyric array format', () => {
    expect(
      parseLyricsFile([
        { time: 1, jp: ' 一 ', pron: '', ko: '' },
        { time: 2, jp: '二', pron: ' 니 ', ko: '둘' },
      ])
    ).toEqual({
      lyrics: [
        { time: 1, jp: '一', pron: '', ko: '' },
        { time: 2, jp: '二', pron: '니', ko: '둘' },
      ],
    });
  });

  it('accepts an envelope with an explicit song slug', () => {
    expect(
      parseLyricsFile({
        slug: 'odoriko',
        lyrics: [{ time: 1, jp: '踊り子' }],
      })
    ).toEqual({
      slug: 'odoriko',
      lyrics: [{ time: 1, jp: '踊り子', pron: '', ko: '' }],
    });
  });

  it.each([
    ['an empty array', [], 'JSON 배열'],
    ['a negative timestamp', [{ time: -1, jp: '歌' }], '시간이 올바르지'],
    ['a missing original lyric', [{ time: 1, jp: '' }], '일본어 원문'],
    ['a malformed pronunciation', [{ time: 1, jp: '歌', pron: 1 }], '발음 또는 번역'],
    [
      'timestamps that move backwards',
      [
        { time: 2, jp: '先' },
        { time: 1, jp: '後' },
      ],
      '이전 줄보다 커야',
    ],
    [
      'duplicate timestamps',
      [
        { time: 1, jp: '一' },
        { time: 1, jp: '二' },
      ],
      '이전 줄보다 커야',
    ],
  ])('rejects %s', (_case, value, message) => {
    expect(() => parseLyricsFile(value)).toThrow(message);
  });
});

describe('parseLyricsImportFile', () => {
  it('accepts a complete local-library backup', () => {
    const songs = [
      { slug: 'odoriko', lyrics: [{ time: 1, jp: '踊り子', pron: '', ko: '' }] },
      { slug: 'napori', lyrics: [{ time: 2, jp: '歌', pron: '우타', ko: '노래' }] },
    ];
    const backup = createLyricsLibraryBackup(songs);

    expect(backup.schemaVersion).toBe(LYRICS_BACKUP_SCHEMA_VERSION);
    expect(backup.exportedAt).toEqual(expect.any(String));
    expect(parseLyricsImportFile(backup)).toEqual(songs);
  });

  it('rejects an unknown backup version', () => {
    expect(() =>
      parseLyricsImportFile({
        schemaVersion: 999,
        songs: [{ slug: 'odoriko', lyrics: [{ time: 1, jp: '踊り子' }] }],
      })
    ).toThrow('지원하지 않는 가사 백업 버전');
  });

  it('rejects duplicate songs in a backup', () => {
    expect(() =>
      parseLyricsImportFile({
        schemaVersion: LYRICS_BACKUP_SCHEMA_VERSION,
        songs: [
          { slug: 'odoriko', lyrics: [{ time: 1, jp: '一' }] },
          { slug: 'odoriko', lyrics: [{ time: 2, jp: '二' }] },
        ],
      })
    ).toThrow('같은 곡이 두 번');
  });

  it('never creates a backup that its own importer must reject', () => {
    const songs = Array.from({ length: MAX_LYRICS_LIBRARY_SONGS + 1 }, (_, index) => ({
      slug: `song-${index}`,
      lyrics: [{ time: 1, jp: '練習', pron: '', ko: '' }],
    }));

    expect(() => createLyricsLibraryBackup(songs)).toThrow(`한 백업은 ${MAX_LYRICS_LIBRARY_SONGS}곡`);
  });

  it('serializes a backup in the same pretty JSON shape used for download', () => {
    const songs = [{ slug: 'odoriko', lyrics: [{ time: 1, jp: '練習', pron: '', ko: '' }] }];

    expect(JSON.parse(serializeLyricsLibraryBackup(songs))).toMatchObject({ songs });
  });
});

describe('slugFromFileName', () => {
  it('removes a json extension without changing the song slug', () => {
    expect(slugFromFileName('kaiju-no-hanauta.json')).toBe('kaiju-no-hanauta');
  });
});

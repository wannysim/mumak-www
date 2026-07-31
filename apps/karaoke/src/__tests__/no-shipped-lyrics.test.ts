import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { assertNoShippedLyrics } from '../../scripts/no-shipped-lyrics.mjs';

describe('no-shipped-lyrics guard', () => {
  let fixtureRoot: string;

  beforeEach(() => {
    fixtureRoot = mkdtempSync(path.join(os.tmpdir(), 'karaoke-lyrics-guard-'));
  });

  afterEach(() => {
    rmSync(fixtureRoot, { force: true, recursive: true });
  });

  it('allows app shell files and plain-text license notices', () => {
    mkdirSync(path.join(fixtureRoot, 'licenses'));
    writeFileSync(path.join(fixtureRoot, 'manifest.webmanifest'), '{}');
    writeFileSync(path.join(fixtureRoot, 'licenses', 'pretendard-ofl.txt'), 'license');
    writeFileSync(path.join(fixtureRoot, 'licenses', 'noto-serif-jp-ofl.txt'), 'license');

    expect(() => assertNoShippedLyrics(fixtureRoot, 'fixture')).not.toThrow();
  });

  it('rejects an unreviewed text file even when it is hidden among license notices', () => {
    mkdirSync(path.join(fixtureRoot, 'licenses'));
    writeFileSync(path.join(fixtureRoot, 'licenses', 'lyrics.txt'), 'synthetic test data');

    expect(() => assertNoShippedLyrics(fixtureRoot, 'fixture')).toThrow(`licenses${path.sep}lyrics.txt`);
  });

  it.each(['song.lrc', 'song.txt', 'song'])('rejects every file type inside the lyrics directory: %s', fileName => {
    mkdirSync(path.join(fixtureRoot, 'lyrics'), { recursive: true });
    writeFileSync(path.join(fixtureRoot, 'lyrics', fileName), 'synthetic test data');

    expect(() => assertNoShippedLyrics(fixtureRoot, 'fixture')).toThrow(`lyrics${path.sep}${fileName}`);
  });

  it.each(['songs.json', 'songs.srt', 'songs.yaml'])(
    'rejects a lyric-like public payload outside the lyrics directory: %s',
    fileName => {
      mkdirSync(path.join(fixtureRoot, 'data'), { recursive: true });
      writeFileSync(path.join(fixtureRoot, 'data', fileName), 'synthetic test data');

      expect(() => assertNoShippedLyrics(fixtureRoot, 'fixture')).toThrow(`data${path.sep}${fileName}`);
    }
  );
});

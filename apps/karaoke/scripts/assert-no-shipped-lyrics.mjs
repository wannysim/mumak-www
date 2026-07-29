import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { assertNoShippedLyrics } from './no-shipped-lyrics.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];

if (target !== 'public' && target !== 'dist') {
  throw new Error('검사 대상은 public 또는 dist여야 합니다.');
}

try {
  assertNoShippedLyrics(path.join(appRoot, target), target);
} catch (error) {
  console.error(error instanceof Error ? error.message : `${target} 가사 배포 검사가 실패했습니다.`);
  process.exitCode = 1;
}

import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { localProgress } from '../local-progress';
import { emptyProgress } from '../progress';

it('persists local records, accepts retries and preserves the newer revision on conflict', () => {
  const directory = mkdtempSync(join(tmpdir(), 'interview-'));
  try {
    expect(localProgress(directory).document.revision).toBeNull();
    const write = { revision: randomUUID(), baseRevision: null, progress: emptyProgress() };
    const saved = localProgress(directory, write);
    expect(saved.accepted).toBe(true);
    expect(localProgress(directory)).toEqual(saved);
    expect(localProgress(directory, write)).toEqual(saved);
    expect(localProgress(directory, { ...write, revision: randomUUID() })).toEqual({ ...saved, accepted: false });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

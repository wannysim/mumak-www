import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { emptyCloudProgress, parseCloudProgress, type ProgressWrite } from '@/lib/cloud-progress';

export function localProgress(directory: string, write?: ProgressWrite) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(join(directory, 'progress.sqlite'));
  try {
    db.exec('PRAGMA busy_timeout = 3000');
    db.exec('CREATE TABLE IF NOT EXISTS progress (id INTEGER PRIMARY KEY, document TEXT NOT NULL)');
    db.exec(write ? 'BEGIN IMMEDIATE' : 'BEGIN');
    const raw = db.prepare('SELECT document FROM progress WHERE id = 1').get()?.document;
    let document = raw === undefined ? emptyCloudProgress() : parseCloudProgress(JSON.parse(String(raw)));
    const accepted = !write || write.revision === document.revision || write.baseRevision === document.revision;
    if (write && accepted && write.revision !== document.revision) {
      document = { revision: write.revision, progress: write.progress };
      db.prepare('INSERT OR REPLACE INTO progress VALUES (1, ?)').run(JSON.stringify(document));
    }
    db.exec('COMMIT');
    return { accepted, document };
  } finally {
    db.close();
  }
}

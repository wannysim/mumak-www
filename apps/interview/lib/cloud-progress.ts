import { emptyProgress, parseProgress, type Progress } from '@/lib/progress';

export type CloudProgress = { revision: string | null; progress: Progress };
export type ProgressWrite = { baseRevision: string | null; revision: string; progress: Progress };
const validRevision = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value);
export const emptyCloudProgress = (): CloudProgress => ({ revision: null, progress: emptyProgress() });
export function parseCloudProgress(value: unknown): CloudProgress {
  if (!value || typeof value !== 'object' || !('revision' in value) || !('progress' in value))
    throw new Error('Invalid cloud record');
  if (value.revision !== null && !validRevision(value.revision)) throw new Error('Invalid revision');
  return { revision: value.revision, progress: parseProgress(JSON.stringify(value.progress)) };
}
export function parseProgressWrite(value: unknown): ProgressWrite {
  const document = parseCloudProgress(value);
  if (!document.revision || !value || typeof value !== 'object' || !('baseRevision' in value))
    throw new Error('Invalid write');
  if (value.baseRevision !== null && !validRevision(value.baseRevision)) throw new Error('Invalid base revision');
  if (value.baseRevision === document.revision) throw new Error('Reused revision');
  return { ...document, revision: document.revision, baseRevision: value.baseRevision };
}

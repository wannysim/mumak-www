import { codeProblems, questions, stories } from '@/lib/curriculum';

type Attempt = { id: string; correct: boolean; at: number };
export type Session = { minutes: number; remaining: number; deadline: number | null; questionId: string };
export type Progress = {
  version: 1;
  attempts: Attempt[];
  review: string[];
  drafts: Record<string, string>;
  notes: Record<string, string>;
  session: Session | null;
};
export const MAX_BACKUP_BYTES = 2_000_000;
export const STORAGE_KEY = 'next-stop:progress:v1';
export const emptyProgress = (): Progress => ({
  version: 1,
  attempts: [],
  review: [],
  drafts: {},
  notes: {},
  session: null,
});
const questionIds = new Set(questions.map(q => q.id));
const exerciseIds = new Set([...questionIds, ...codeProblems.map(p => p.id)]);
const noteIds = new Set([
  ...stories.flatMap(s => Array.from({ length: 5 }, (_, i) => `${s.id}:${i}`)),
  ...codeProblems.map(p => `${p.id}:plan`),
]);
function byteLength(text: string) {
  return new TextEncoder().encode(text).byteLength;
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function textMap(value: unknown, allowed: Set<string>, max: number): value is Record<string, string> {
  return (
    record(value) &&
    Object.entries(value).every(([key, text]) => allowed.has(key) && typeof text === 'string' && text.length <= max)
  );
}
export function parseProgress(raw: string): Progress {
  if (byteLength(raw) > MAX_BACKUP_BYTES) throw new Error('백업 파일이 너무 큽니다.');
  const value: unknown = JSON.parse(raw);
  if (
    !record(value) ||
    value.version !== 1 ||
    !Array.isArray(value.attempts) ||
    value.attempts.length > 500 ||
    !value.attempts.every(
      a =>
        record(a) &&
        typeof a.id === 'string' &&
        exerciseIds.has(a.id) &&
        typeof a.correct === 'boolean' &&
        typeof a.at === 'number' &&
        Number.isSafeInteger(a.at) &&
        a.at >= 0
    ) ||
    !Array.isArray(value.review) ||
    value.review.length > exerciseIds.size ||
    !value.review.every(id => typeof id === 'string' && exerciseIds.has(id)) ||
    !textMap(value.drafts, new Set(codeProblems.map(p => p.id)), 20000) ||
    !textMap(value.notes, noteIds, 10000)
  )
    throw new Error('지원하는 연습 기록 파일이 아닙니다.');
  if (value.session !== null) {
    const s = value.session;
    if (
      !record(s) ||
      typeof s.minutes !== 'number' ||
      ![5, 10, 15].includes(s.minutes) ||
      typeof s.remaining !== 'number' ||
      !Number.isFinite(s.remaining) ||
      s.remaining < 0 ||
      s.remaining > Number(s.minutes) * 60 ||
      (s.deadline !== null &&
        (typeof s.deadline !== 'number' || !Number.isSafeInteger(s.deadline) || s.deadline < 0)) ||
      typeof s.questionId !== 'string' ||
      !questionIds.has(s.questionId)
    )
      throw new Error('연습 세션 정보가 올바르지 않습니다.');
  }
  return {
    version: 1,
    attempts: value.attempts as Attempt[],
    review: [...new Set(value.review as string[])],
    drafts: { ...value.drafts },
    notes: { ...value.notes },
    session: value.session as Session | null,
  };
}
export function recordAttempt(progress: Progress, id: string, correct: boolean, now = Date.now()): Progress {
  return {
    ...progress,
    attempts: [...progress.attempts, { id, correct, at: now }].slice(-500),
    review: correct ? progress.review.filter(item => item !== id) : [...new Set([...progress.review, id])],
  };
}
export function understoodIds(progress: Progress) {
  const latest = new Map(progress.attempts.map(attempt => [attempt.id, attempt.correct]));
  return new Set([...latest].filter(([, correct]) => correct).map(([id]) => id));
}
export function remainingSeconds(session: Session, now: number) {
  return session.deadline === null
    ? session.remaining
    : Math.max(0, Math.min(session.minutes * 60, Math.ceil((session.deadline - now) / 1000)));
}
export function localDateKey(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

import { codeProblems, stories } from '../curriculum';
import {
  emptyProgress,
  localDateKey,
  parseProgress,
  recordAttempt,
  remainingSeconds,
  resumableCodeProblems,
  understoodIds,
} from '../progress';

describe('durable practice records', () => {
  it('round trips notes, drafts and a paused session', () => {
    const p = {
      ...emptyProgress(),
      notes: { 'ownership:0': '내가 해결한 문제' },
      drafts: { cart: 'function solve() {}' },
      session: { minutes: 5, remaining: 200, deadline: null, questionId: 'event-loop' },
    };
    expect(parseProgress(JSON.stringify(p))).toEqual(p);
    expect(parseProgress(JSON.stringify(emptyProgress()))).toEqual(emptyProgress());
  });
  it('rejects incompatible, corrupted and oversized data without migration guesses', () => {
    for (const raw of ['{}', 'null', 'bad', '가'.repeat(700000)]) expect(() => parseProgress(raw)).toThrow();
    for (const patch of [
      { version: 2 },
      { notes: { unknown: 'text' } },
      { drafts: { cart: 'a'.repeat(20001) } },
      { review: ['unknown'] },
      { attempts: [{ id: 'event-loop', at: -1, correct: true }] },
      { session: { minutes: 5, remaining: 999, deadline: null, questionId: 'event-loop' } },
    ])
      expect(() => parseProgress(JSON.stringify({ ...emptyProgress(), ...patch }))).toThrow();
  });
  it('round trips large Unicode notes and drafts within the aggregate byte budget', () => {
    const progress = {
      ...emptyProgress(),
      notes: Object.fromEntries(
        stories.flatMap(s => Array.from({ length: 5 }, (_, i) => [`${s.id}:${i}`, '가'.repeat(10000)]))
      ),
      drafts: Object.fromEntries(codeProblems.map(p => [p.id, '나'.repeat(1000)])),
    };
    expect(parseProgress(JSON.stringify(progress))).toEqual(progress);
    expect(() =>
      parseProgress(
        JSON.stringify({
          ...progress,
          drafts: Object.fromEntries(codeProblems.map(p => [p.id, '나'.repeat(20000)])),
        })
      )
    ).toThrow('백업 파일이 너무 큽니다.');
  });
  it('preserves new whiteboard notes and existing version 1 data', () => {
    const progress = {
      ...emptyProgress(),
      notes: { 'list-reverse:plan': 'prev ← cur → next' },
      drafts: { 'window-unique': 'function solve(text) {}' },
    };
    expect(parseProgress(JSON.stringify(progress))).toEqual(progress);
  });
  it('validates active timer fields', () => {
    const session = { minutes: 10, remaining: 600, deadline: 1793500000000, questionId: 'race' };
    expect(parseProgress(JSON.stringify({ ...emptyProgress(), session })).session).toEqual(session);
    for (const patch of [
      { minutes: 8 },
      { remaining: -1 },
      { remaining: '3' },
      { deadline: -1 },
      { deadline: 'now' },
      { questionId: 'missing' },
    ])
      expect(() => parseProgress(JSON.stringify({ ...emptyProgress(), session: { ...session, ...patch } }))).toThrow();
  });
  it('adds incorrect answers to review once and removes them after success', () => {
    const wrong = recordAttempt(recordAttempt(emptyProgress(), 'event-loop', false, 100), 'event-loop', false, 200);
    expect(wrong.review).toEqual(['event-loop']);
    const right = recordAttempt(wrong, 'event-loop', true, 300);
    expect(right.review).toEqual([]);
    expect(right.attempts).toHaveLength(3);
    expect(parseProgress(JSON.stringify(right))).toEqual(right);
    expect(understoodIds(right).has('event-loop')).toBe(true);
    expect(understoodIds(recordAttempt(right, 'event-loop', false, 400)).has('event-loop')).toBe(false);
  });
  it('resumes only code problems with real work, in curriculum order', () => {
    const [starter, padded, blank, edited, planned, blankPlan] = codeProblems;
    const progress = {
      ...emptyProgress(),
      drafts: {
        [starter!.id]: starter!.starter,
        [padded!.id]: `\n${padded!.starter}\n  `,
        [blank!.id]: '  \n',
        [edited!.id]: '// 이어 쓸 코드',
      },
      notes: { [`${planned!.id}:plan`]: '경계 조건 먼저', [`${blankPlan!.id}:plan`]: '   ' },
    };
    expect(resumableCodeProblems(progress).map(problem => problem.id)).toEqual([edited!.id, planned!.id]);
    expect(resumableCodeProblems(emptyProgress())).toEqual([]);
    // A reset draft with a remaining plan still has work to resume.
    expect(
      resumableCodeProblems({ ...progress, notes: { [`${starter!.id}:plan`]: '계획' } }).map(problem => problem.id)
    ).toEqual([starter!.id, edited!.id]);
  });
  it('bounds attempt history', () => {
    let p = emptyProgress();
    for (let i = 0; i < 501; i++) p = recordAttempt(p, 'cart', true, i);
    expect(p.attempts).toHaveLength(500);
    expect(p.attempts[0]?.at).toBe(1);
  });
  it('uses elapsed wall time, not a count of interval callbacks', () => {
    const session = { minutes: 5, remaining: 200, deadline: 300000, questionId: 'race' };
    expect(remainingSeconds(session, 100000)).toBe(200);
    expect(remainingSeconds(session, 500000)).toBe(0);
    expect(remainingSeconds(session, -1000)).toBe(300);
    expect(remainingSeconds({ ...session, deadline: null }, 500000)).toBe(200);
    const date = new Date(2026, 10, 1, 23, 30);
    expect(localDateKey(date.getTime())).toBe('2026-11-1');
  });
});

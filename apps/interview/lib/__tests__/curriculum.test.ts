import vm from 'node:vm';

import type { RunResult } from '../code-runner';
import { workerSource } from '../code-worker';
import { codeProblems, questions, type CodeTest } from '../curriculum';
import { categories, difficulties } from '../problems/types';

// Only checked-in, authored examples run here. User submissions run in the browser sandbox.
async function evaluate(code: string, tests: CodeTest[]): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const context = vm.createContext({
      structuredClone,
      setTimeout,
      clearTimeout,
      self: { postMessage: resolve },
      payload: { code, tests },
    });
    try {
      new vm.Script(workerSource + '\nself.onmessage({data:payload});').runInContext(context, { timeout: 1500 });
    } catch (error) {
      reject(error);
    }
  });
}
function problem(id: string) {
  const match = codeProblems.find(p => p.id === id);
  if (!match) throw new Error(`Unknown exercise ${id}`);
  return match;
}
function expectPass(result: RunResult, count: number) {
  expect(result.error).toBeUndefined();
  expect(result.results).toHaveLength(count);
  expect(result.results.filter(r => !r.passed)).toEqual([]);
}

describe('authored curriculum and real grading harness', () => {
  it('covers all declared categories and levels with unique IDs', () => {
    const ids = [...questions, ...codeProblems].map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(codeProblems.map(p => p.category))).toEqual(new Set(categories));
    expect(new Set(codeProblems.map(p => p.difficulty))).toEqual(new Set(difficulties));
  });
  it.each(codeProblems)('$id: reference passes and unfinished starter does not pass', async p => {
    expectPass(await evaluate(p.solution, p.tests), p.tests.length);
    const starter = await evaluate(p.starter, p.tests);
    expect(Boolean(starter.error) || starter.results.some(r => !r.passed)).toBe(true);
  });
  it.each([
    [
      'list-reverse',
      'function solve(head) { const values=[]; while(head){values.push(head.value);head=head.next;} return values.reduce((next,value)=>({value,next}),null); }',
    ],
    ['list-cycle', 'function solve(head) { return head ? {value:head.value,next:null} : null; }'],
    ['list-random', 'function solve(head) { return head; }'],
    ['list-deque', problem('list-deque').solution.replace('if(head) head.prev=node;', 'if(head) head.prev=null;')],
    ['list-basic', problem('list-basic').solution.replace('if(tail===node) tail=previous;', '')],
    [
      'list-basic',
      problem('list-basic').solution.replace('if(tail===node) tail=previous;', 'if(tail===node) tail=null;'),
    ],
    ['queue', 'async function solve(tasks) { return tasks.map((_,i)=>i); }'],
  ])('%s rejects plausible-looking but structurally invalid output', async (id, code) => {
    const result = await evaluate(code, problem(id).tests);
    expect(Boolean(result.error) || result.results.some(r => !r.passed)).toBe(true);
  });
  it('matches independent brute-force window, prefix and heap models on deterministic samples', async () => {
    const cases: Record<string, CodeTest[]> = {
      'window-fixed': [],
      'window-unique': [],
      'prefix-sum': [],
      'heap-kth': [],
    };
    for (let seed = 0; seed < 40; seed++) {
      const values = Array.from({ length: seed % 9 }, (_, i) => ((seed * 7 + i * i) % 11) - 5);
      const k = (seed % 4) + 1;
      const sums = Array.from({ length: Math.max(0, values.length - k + 1) }, (_, i) =>
        values.slice(i, i + k).reduce((a, b) => a + b, 0)
      );
      cases['window-fixed']!.push({
        label: `sample ${seed}`,
        args: [values, k],
        expected: sums.length ? Math.max(...sums) : null,
      });
      const text = values.map(v => String.fromCharCode(97 + (Math.abs(v) % 4))).join('');
      let longest = 0,
        count = 0;
      for (let left = 0; left < values.length; left++)
        for (let right = left + 1; right <= values.length; right++) {
          const slice = text.slice(left, right);
          if (new Set(slice).size === slice.length) longest = Math.max(longest, slice.length);
          if (values.slice(left, right).reduce((a, b) => a + b, 0) === seed % 3) count++;
        }
      cases['window-unique']!.push({ label: `sample ${seed}`, args: [text], expected: longest });
      cases['prefix-sum']!.push({ label: `sample ${seed}`, args: [values, seed % 3], expected: count });
      cases['heap-kth']!.push({
        label: `sample ${seed}`,
        args: [values, k],
        expected: values.map((_, i) => values.slice(0, i + 1).toSorted((a, b) => b - a)[k - 1] ?? null),
      });
    }
    for (const [id, tests] of Object.entries(cases))
      expectPass(await evaluate(problem(id).solution, tests), tests.length);
  });
  it('checks every prefix of list/deque operations, including transient endpoint transitions', async () => {
    const listOps = [
      ['append', 1],
      ['append', 2],
      ['prepend', 0],
      ['delete', 2],
      ['delete', 0],
      ['delete', 1],
      ['delete', 9],
      ['append', 3],
    ];
    const dequeOps = [
      ['pushBack', 1],
      ['pushFront', 0],
      ['pushBack', 2],
      ['popFront'],
      ['popBack'],
      ['popBack'],
      ['popFront'],
      ['pushFront', 3],
    ];
    const list: number[] = [],
      deque: number[] = [],
      removed: (number | null)[] = [];
    const listTests: CodeTest[] = [],
      dequeTests: CodeTest[] = [];
    for (let i = 0; i < listOps.length; i++) {
      const [op, v] = listOps[i]!;
      const value = Number(v);
      if (op === 'append') list.push(value);
      else if (op === 'prepend') list.unshift(value);
      else {
        const at = list.indexOf(value);
        if (at >= 0) list.splice(at, 1);
      }
      listTests.push({ label: `step ${i}`, args: [listOps.slice(0, i + 1)], expected: [...list], mode: 'list' });
      const [command, dv] = dequeOps[i]!;
      if (command === 'pushBack') deque.push(Number(dv));
      else if (command === 'pushFront') deque.unshift(Number(dv));
      else if (command === 'popFront') removed.push(deque.shift() ?? null);
      else removed.push(deque.pop() ?? null);
      dequeTests.push({
        label: `step ${i}`,
        args: [dequeOps.slice(0, i + 1)],
        expected: { values: [...deque], removed: [...removed] },
        mode: 'deque',
      });
    }
    expectPass(await evaluate(problem('list-basic').solution, listTests), listTests.length);
    expectPass(await evaluate(problem('list-deque').solution, dequeTests), dequeTests.length);
  });
});

import vm from 'node:vm';

import type { RunResult } from '../code-runner';
import { workerSource } from '../code-worker';
import { codeProblems, questions, type CodeTest } from '../curriculum';
import { categories, difficulties } from '../problems/types';
import { emptyProgress, parseProgress } from '../progress';

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
    ['window-min-sum', problem('window-min-sum').solution.replace('while (sum >= target)', 'if (sum >= target)')],
    ['window-min-sum', problem('window-min-sum').solution.replace('sum >= target', 'sum > target')],
    [
      'window-k-distinct',
      problem('window-k-distinct').solution.replace(
        'if (counts.get(leaving) === 0) counts.delete(leaving);',
        'counts.delete(leaving);'
      ),
    ],
    ['window-k-distinct', problem('window-k-distinct').solution.replace('(counts.get(char) || 0) + 1', '1')],
    [
      'events',
      'function solve(events) { const seen = new Set(); return events.filter(event => { if (seen.has(event.id)) return false; seen.add(event.id); return true; }).map(event => ({...event})); }',
    ],
    ['window-cover', problem('window-cover').solution.replace('right - left + 1 < size', 'right - left + 1 <= size')],
    [
      'tree-level',
      'function solve(root) { if (!root) return []; const children = [root.left, root.right].filter(Boolean); return children.length ? [[root.value], children.map(node => node.value)] : [[root.value]]; }',
    ],
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
  it('matches independent exhaustive models for the two bridge windows', async () => {
    const minimumTests: CodeTest[] = [];
    const distinctTests: CodeTest[] = [];
    for (let length = 0; length <= 4; length++) {
      for (let seed = 0; seed < 3 ** length; seed++) {
        let digits = seed;
        const values = Array.from({ length }, () => {
          const value = (digits % 3) + 1;
          digits = Math.floor(digits / 3);
          return value;
        });
        const text = values.map(value => String.fromCharCode(96 + value)).join('');
        for (let target = 1; target <= 8; target++) {
          let best = Infinity;
          for (let left = 0; left < length; left++) {
            for (let right = left + 1; right <= length; right++) {
              if (values.slice(left, right).reduce((sum, value) => sum + value, 0) >= target)
                best = Math.min(best, right - left);
            }
          }
          minimumTests.push({
            label: `${seed}/${length}/${target}`,
            args: [values, target],
            expected: best === Infinity ? 0 : best,
          });
        }
        for (let k = 0; k <= 4; k++) {
          let best = 0;
          for (let left = 0; left < length; left++) {
            for (let right = left + 1; right <= length; right++) {
              if (new Set(text.slice(left, right)).size <= k) best = Math.max(best, right - left);
            }
          }
          distinctTests.push({ label: `${seed}/${length}/${k}`, args: [text, k], expected: best });
        }
      }
    }
    expectPass(await evaluate(problem('window-min-sum').solution, minimumTests), minimumTests.length);
    expectPass(await evaluate(problem('window-k-distinct').solution, distinctTests), distinctTests.length);
  });
  it('keeps version-one backups compatible and accepts new exercise drafts and plans', () => {
    const legacy = { ...emptyProgress(), drafts: { cart: 'function solve() {}' }, notes: { 'cart:plan': '기존 메모' } };
    expect(parseProgress(JSON.stringify(legacy))).toEqual(legacy);
    const expanded = {
      ...legacy,
      attempts: [{ id: 'window-min-sum', correct: true, at: 1 }],
      review: ['window-k-distinct'],
      drafts: { ...legacy.drafts, 'window-min-sum': 'function solve() {}', 'window-k-distinct': 'function solve() {}' },
      notes: { ...legacy.notes, 'window-min-sum:plan': '최소 길이', 'window-k-distinct:plan': '최대 길이' },
    };
    expect(parseProgress(JSON.stringify(expanded))).toEqual(expanded);
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

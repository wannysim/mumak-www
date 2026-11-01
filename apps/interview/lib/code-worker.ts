// Shared browser worker source; only authored reference solutions are evaluated in Node tests.
export const workerSource = `
function equal(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left) && left.length !== right.length) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && equal(left[key], right[key]));
}

function walk(head) {
  const seen = new Set(), nodes = [];
  for (let node = head; node !== null; node = node.next) {
    if (!node || typeof node !== 'object' || seen.has(node) || nodes.length >= 10000) throw new Error('종료되지 않거나 잘못 연결된 리스트입니다.');
    seen.add(node); nodes.push(node);
  }
  return nodes;
}
function check(condition, message) { if (!condition) throw new Error(message); }
async function runLinkedTest(solve, args, mode) {
  if (mode === 'list' || mode === 'deque') {
    const result = await solve(...args);
    check(result && typeof result === 'object', 'head, tail, size를 가진 객체를 반환하세요.');
    const nodes = walk(result.head);
    check(result.size === nodes.length && result.tail === (nodes.at(-1) || null), 'size 또는 tail 참조가 실제 연결과 다릅니다.');
    if (mode === 'list') return nodes.map(node => node.value);
    for (let i = 0; i < nodes.length; i++) check(nodes[i].prev === (nodes[i-1] || null), 'prev가 이전 노드를 가리키지 않습니다.');
    check(Array.isArray(result.removed), 'removed 배열을 반환하세요.');
    return {values: nodes.map(node => node.value), removed: result.removed};
  }
  const nodes = args[0].map(value => ({value, next:null}));
  for (let i = 0; i < nodes.length; i++) nodes[i].next = nodes[i+1] || null;
  if (mode === 'cycle' && nodes.length && args[1] >= 0) nodes.at(-1).next = nodes[args[1]];
  if (mode === 'copy-random') nodes.forEach((node,i) => {node.random = nodes[args[1][i]] || null;});
  const snapshot = nodes.map(node => ({value:node.value, next:node.next, random:node.random}));
  const output = await solve(nodes[0] || null);
  if (mode === 'reverse') {
    const reversed = walk(output);
    check(reversed.length === nodes.length && reversed.every((node,i) => node === nodes[nodes.length-1-i] && node.value === snapshot[nodes.length-1-i].value), '새 노드나 값 변경 없이 기존 노드 자체를 역순으로 연결하세요.');
    return reversed.map(node => node.value);
  }
  check(nodes.every((node,i) => node.value === snapshot[i].value && node.next === snapshot[i].next && node.random === snapshot[i].random), '원본 노드나 연결을 변경하면 안 됩니다.');
  if (mode === 'cycle') {
    check(output === null || nodes.includes(output), '원본의 실제 노드 참조 또는 null을 반환하세요.');
    return output === null ? -1 : nodes.indexOf(output);
  }
  const copies = walk(output);
  check(copies.length === nodes.length && copies.every(node => !nodes.includes(node)), '모든 노드를 새로 만들어 깊은 복사하세요.');
  check(copies.every(node => node.random === null || copies.includes(node.random)), 'random도 복사본 안의 노드 또는 null이어야 합니다.');
  return {values:copies.map(node => node.value), random:copies.map(node => node.random === null ? -1 : copies.indexOf(node.random))};
}

self.onmessage = async ({ data }) => {
  const results = [];
  try {
    for (const test of data.tests) {
      const solve = new Function('"use strict";\\n' + data.code + '\\n;return solve;')();
      const args = structuredClone(test.args);
      const before = JSON.stringify(args);
      let active = 0, maxActive = 0;
      let calls = [], completed = [];
      let output;
      if (test.queue) {
        calls = args[0].map(() => 0); completed = args[0].map(() => 0);
        const tasks = args[0].map((delay, index) => async () => {
          calls[index]++;
          active++; maxActive = Math.max(maxActive, active);
          await new Promise(resolve => setTimeout(resolve, delay));
          active--; completed[index]++; return index;
        });
        output = await solve(tasks, args[1]);
      } else if (test.mode) { output = await runLinkedTest(solve, args, test.mode); }
      else { output = await solve(...args); }
      const matches = equal(output, test.expected);
      const unchanged = JSON.stringify(args) === before;
      const limited = !test.queue || (maxActive <= args[1] && active === 0 && calls.every(n => n === 1) && completed.every(n => n === 1));
      results.push({ label: test.label, passed: matches && unchanged && limited,
        detail: !unchanged ? '입력 데이터가 변경됐어요.' : !limited ? '각 작업을 정확히 한 번 완료하고 동시 실행 수 제한을 지켜 주세요.' : matches ? '예상 결과와 일치해요.' : '예상: ' + JSON.stringify(test.expected) + ' / 결과: ' + String(JSON.stringify(output)).slice(0, 300) });
    }
    self.postMessage({ results });
  } catch(error) { self.postMessage({ results, error: String(error.message || error).slice(0, 500) }); }
};`;

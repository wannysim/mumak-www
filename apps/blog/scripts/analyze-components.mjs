#!/usr/bin/env node
// apps/blog 정적 분석: 리팩토링 우선순위 TOP 5 + 의존성 그래프 병목 진단
// 사용법: node scripts/analyze-components.mjs (apps/blog 루트에서)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SCAN_DIRS = ['src', 'app'];
const EXTS = ['.tsx', '.ts'];
const isSource = p => EXTS.some(e => p.endsWith(e)) && !/__tests__|\.test\.|\.spec\.|\.d\.ts$/.test(p);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== 'node_modules') walk(p, acc);
    } else if (isSource(p)) acc.push(p);
  }
  return acc;
}

const files = SCAN_DIRS.flatMap(d => walk(join(ROOT, d)));
const fileSet = new Set(files);

// ponytail: 정규식 파싱. 오탐이 문제되면 ts-morph로 교체
function resolveImport(fromFile, spec) {
  let base;
  if (spec.startsWith('@/')) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec);
  else return null; // 외부 패키지
  for (const cand of [base, ...EXTS.map(e => base + e), ...EXTS.map(e => join(base, 'index' + e))]) {
    if (fileSet.has(cand)) return cand;
  }
  return null;
}

const metrics = new Map();
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n').length;
  const importSpecs = [...src.matchAll(/(?:^|\n)import[\s\S]*?from\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
  const states = (src.match(/\buse(State|Reducer)\s*[<(]/g) ?? []).length;
  const effects = (src.match(/\buseEffect\s*\(/g) ?? []).length;
  const internalDeps = importSpecs.map(s => resolveImport(file, s)).filter(Boolean);
  metrics.set(file, {
    lines,
    imports: importSpecs.length,
    states,
    effects,
    deps: [...new Set(internalDeps)],
    isComponent: file.endsWith('.tsx'),
  });
}

// --- 1. 리팩토링 TOP 5 ---
const score = m => m.lines / 50 + m.imports + m.states * 3 + m.effects * 2;
const top5 = [...metrics]
  .filter(([, m]) => m.isComponent)
  .toSorted((a, b) => score(b[1]) - score(a[1]))
  .slice(0, 5);

console.log('## 1. 리팩토링 시급 컴포넌트 TOP 5');
console.log('score = lines/50 + imports + states*3 + effects*2\n');
for (const [file, m] of top5) {
  console.log(
    `- ${relative(ROOT, file)}  [score ${score(m).toFixed(1)}]` +
      `  lines=${m.lines} imports=${m.imports} states=${m.states} effects=${m.effects}`
  );
}

// --- 2. 의존성 그래프 병목 ---
const fanIn = new Map(files.map(f => [f, 0]));
for (const [, m] of metrics) for (const d of m.deps) fanIn.set(d, (fanIn.get(d) ?? 0) + 1);

const depthCache = new Map();
const inStack = new Set();
const cycles = [];
function depth(file, path = []) {
  if (depthCache.has(file)) return depthCache.get(file);
  if (inStack.has(file)) {
    cycles.push([...path.slice(path.indexOf(file)), file]);
    return 0;
  }
  inStack.add(file);
  const d = 1 + Math.max(0, ...metrics.get(file).deps.map(x => depth(x, [...path, file])));
  inStack.delete(file);
  depthCache.set(file, d);
  return d;
}

console.log('\n## 2. 구조적 병목 진단');
const hotspots = [...fanIn]
  .filter(([, n]) => n >= 5)
  .toSorted((a, b) => b[1] - a[1])
  .slice(0, 10);
console.log('\n### fan-in 핫스팟 (수정 시 파급 범위가 큰 파일)');
for (const [f, n] of hotspots) console.log(`- ${relative(ROOT, f)}  ← ${n}개 파일이 의존`);

const deepest = files
  .map(f => [f, depth(f)])
  .toSorted((a, b) => b[1] - a[1])
  .slice(0, 5);
console.log('\n### 의존성 체인 최심도 TOP 5 (깊을수록 변경 전파 경로가 김)');
for (const [f, d] of deepest) console.log(`- ${relative(ROOT, f)}  depth=${d}`);

console.log('\n### 순환 의존');
if (cycles.length === 0) console.log('- 없음');
for (const c of cycles.slice(0, 5)) console.log('- ' + c.map(f => relative(ROOT, f)).join(' → '));

// FSD 레이어 위반: shared → features/widgets/entities, entities → features/widgets 등 상향 참조
const LAYER_ORDER = ['shared', 'entities', 'features', 'widgets', 'app'];
const layerOf = f => {
  const rel = relative(ROOT, f);
  if (!rel.startsWith('src/')) return 'app'; // Next app/ 라우트는 최상위 취급
  return LAYER_ORDER.find(l => rel.startsWith(`src/${l}/`)) ?? null;
};
console.log('\n### FSD 레이어 상향 참조 (하위 레이어가 상위 레이어를 import)');
let violations = 0;
for (const [file, m] of metrics) {
  const from = layerOf(file);
  for (const d of m.deps) {
    const to = layerOf(d);
    if (from && to && LAYER_ORDER.indexOf(from) < LAYER_ORDER.indexOf(to)) {
      violations++;
      console.log(`- ${relative(ROOT, file)} (${from}) → ${relative(ROOT, d)} (${to})`);
    }
  }
}
if (violations === 0) console.log('- 없음');

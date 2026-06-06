#!/usr/bin/env node

/**
 * Static design-system guard for apps/blog.
 *
 * Enforces the "UI / 디자인 Contract" section of apps/blog/AGENTS.md:
 *  - semantic tokens only (no raw Tailwind palette colors on the content surface)
 *  - no arbitrary z-index values
 *  - shared UI recipes (segmented nav, content card) are not re-inlined
 *  - shared primitives expose their data-slot anchors
 *
 * No dependencies, no snapshots. Runs inside the existing "Validate (blog)" CI job.
 * Use `--summary` to append a GitHub-flavored markdown summary.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const currentDirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(currentDirname, '..');
const SRC_DIR = path.join(APP_DIR, 'src');
const OUTPUT_SUMMARY = process.argv.includes('--summary');

const PALETTE = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
].join('|');
const COLOR_PREFIX = [
  'text',
  'bg',
  'border',
  'ring',
  'from',
  'via',
  'to',
  'fill',
  'stroke',
  'outline',
  'decoration',
  'divide',
  'accent',
  'caret',
  'placeholder',
  'shadow',
  'ring-offset',
].join('|');
const SHADE = '50|100|200|300|400|500|600|700|800|900|950';

const RAW_COLOR_RE = new RegExp(`\\b(?:${COLOR_PREFIX})-(?:${PALETTE})-(?:${SHADE})\\b`);
const ARBITRARY_Z_RE = /\bz-\[/;

// Files intentionally exempt from the raw-color rule, with a documented reason.
const RAW_COLOR_ALLOWLIST = [
  // Skeuomorphic vinyl widget renders a realistic record (neutral tones + Spotify red),
  // which is art, not themeable surface. Not a theme-token candidate.
  'src/widgets/spotify-vinyl/',
];

// A distinctive class fragment must live ONLY in its canonical primitive file.
// Finding it anywhere else means the shared recipe was re-inlined (drift).
const RECIPE_SIGNATURES = [
  {
    name: 'segmented nav shell',
    fragment: 'h-9 w-fit items-center justify-center rounded-lg p-[3px]',
    canonical: 'src/shared/ui/content-segment-nav.tsx',
    primitive: 'ContentSegmentNav',
  },
  {
    name: 'content card shell',
    fragment: 'hover:bg-muted/50 active:scale-[0.98]',
    canonical: 'src/shared/ui/content-card.tsx',
    primitive: 'ContentCard',
  },
];

// Consumers that must compose the shared primitive instead of re-inlining the recipe.
const PRIMITIVE_CONSUMERS = [
  { file: 'src/widgets/blog-nav/ui/blog-nav.tsx', primitive: 'ContentSegmentNav' },
  { file: 'src/widgets/garden-nav/ui/garden-nav.tsx', primitive: 'ContentSegmentNav' },
  { file: 'src/widgets/post-card/ui/post-card.tsx', primitive: 'ContentCard' },
  { file: 'src/widgets/note-card/ui/note-card.tsx', primitive: 'ContentCard' },
];

// Shared primitives must keep a stable data-slot anchor for tests/review.
const REQUIRED_SLOTS = [
  { file: 'src/shared/ui/content-segment-nav.tsx', slot: 'content-segment-nav' },
  { file: 'src/shared/ui/content-card.tsx', slot: 'content-card' },
];

function listSourceFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === '__tests__') return [];
      return listSourceFiles(fullPath);
    }

    return /\.tsx?$/.test(entry.name) ? [fullPath] : [];
  });
}

function relative(filePath) {
  return path.relative(APP_DIR, filePath).split(path.sep).join('/');
}

function isAllowlisted(rel) {
  return RAW_COLOR_ALLOWLIST.some(prefix => rel.startsWith(prefix));
}

function readApp(rel) {
  const full = path.join(APP_DIR, rel);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
}

const violations = [];
const add = (rule, file, line, message) => violations.push({ rule, file, line, message });

const sourceFiles = listSourceFiles(SRC_DIR);

// Rule 1 & 2: raw palette colors and arbitrary z-index, line by line.
for (const filePath of sourceFiles) {
  const rel = relative(filePath);
  const allow = isAllowlisted(rel);
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');

  lines.forEach((text, index) => {
    const lineNo = index + 1;

    if (!allow && RAW_COLOR_RE.test(text)) {
      add(
        'raw-color',
        rel,
        lineNo,
        `raw Tailwind palette color: "${text.match(RAW_COLOR_RE)[0]}" — use a semantic token`
      );
    }
    if (ARBITRARY_Z_RE.test(text)) {
      add('arbitrary-z-index', rel, lineNo, 'arbitrary z-index (z-[...]) — use a Tailwind z-index scale value');
    }
  });
}

// Rule 3: shared recipe fragments must not be re-inlined outside their canonical file.
for (const { name, fragment, canonical } of RECIPE_SIGNATURES) {
  for (const filePath of sourceFiles) {
    const rel = relative(filePath);
    if (rel === canonical) continue;

    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    lines.forEach((text, index) => {
      if (text.includes(fragment)) {
        add(
          'recipe-drift',
          rel,
          index + 1,
          `${name} re-inlined — compose the shared primitive from ${canonical} instead`
        );
      }
    });
  }
}

// Rule 3b: known consumers must import the shared primitive.
for (const { file, primitive } of PRIMITIVE_CONSUMERS) {
  const content = readApp(file);
  if (content === null) {
    add('primitive-consumer', file, 0, 'expected consumer file is missing');
    continue;
  }
  if (!content.includes(primitive)) {
    add(
      'primitive-consumer',
      file,
      0,
      `should compose ${primitive} from shared/ui rather than re-implementing the recipe`
    );
  }
}

// Rule 4: shared primitives expose their data-slot.
for (const { file, slot } of REQUIRED_SLOTS) {
  const content = readApp(file);
  if (content === null) {
    add('missing-slot', file, 0, 'expected shared primitive file is missing');
    continue;
  }
  if (!content.includes(`data-slot="${slot}"`)) {
    add('missing-slot', file, 0, `missing data-slot="${slot}" anchor`);
  }
}

const RULE_TITLES = {
  'raw-color': 'Raw palette colors',
  'arbitrary-z-index': 'Arbitrary z-index',
  'recipe-drift': 'Re-inlined shared recipe',
  'primitive-consumer': 'Missing shared primitive usage',
  'missing-slot': 'Missing data-slot anchor',
};

function printConsole() {
  if (violations.length === 0) {
    console.log(`✓ validate:design — ${sourceFiles.length} files checked, no violations`);
    return;
  }

  console.error(`✗ validate:design — ${violations.length} violation(s)\n`);
  for (const v of violations) {
    const where = v.line > 0 ? `${v.file}:${v.line}` : v.file;
    console.error(`  [${v.rule}] ${where}\n    ${v.message}`);
  }
  console.error('\nSee the "UI / 디자인 Contract" section of apps/blog/AGENTS.md.');
}

function printSummary() {
  const lines = ['## Design System Validation (blog)', ''];

  if (violations.length === 0) {
    lines.push(`✅ ${sourceFiles.length} files checked, no violations.`);
  } else {
    lines.push(
      `❌ ${violations.length} violation(s) found.`,
      '',
      '| Rule | Location | Detail |',
      '| --- | --- | --- |'
    );
    for (const v of violations) {
      const where = v.line > 0 ? `${v.file}:${v.line}` : v.file;
      lines.push(`| ${RULE_TITLES[v.rule] ?? v.rule} | \`${where}\` | ${v.message} |`);
    }
  }

  console.log(lines.join('\n'));
}

if (OUTPUT_SUMMARY) {
  printSummary();
} else {
  printConsole();
}

process.exit(violations.length > 0 ? 1 : 0);

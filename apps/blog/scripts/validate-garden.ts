#!/usr/bin/env node

import matter from 'gray-matter';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeHeadingToAnchor } from '../src/shared/lib/wikilink/anchor.ts';
import { parseWikilinks } from '../src/shared/lib/wikilink/parser.ts';
import type { WikiLink } from '../src/shared/lib/wikilink/parser.ts';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirname = path.dirname(currentFilePath);

const CONTENT_DIR = path.join(currentDirname, '../content');
const GARDEN_DIR = 'garden';
const LANGUAGES = ['ko', 'en'] as const;
const PRIMARY_LANG = 'ko';
const OUTPUT_SUMMARY = process.argv.includes('--summary');

const VALID_STATUSES = ['seedling', 'budding', 'evergreen'] as const;
const VALID_STATUS_SET = new Set<string>(VALID_STATUSES);
const REQUIRED_FIELDS = ['title', 'created', 'status'] as const;

const BLOCK_MARKER_PATTERN = /(?:^|\s)\^([A-Za-z0-9][\w-]*)\s*$/;

type Language = (typeof LANGUAGES)[number];

type Frontmatter = Record<string, unknown> & {
  parent?: unknown;
  status?: unknown;
  tags?: unknown;
};

type NoteFile = {
  frontmatter: Frontmatter;
  content: string;
};

type AnchorIndex = {
  headings: Set<string>;
  blocks: Set<string>;
};

type ValidationStats = {
  totalNotes: number;
  totalLinks: number;
};

type ValidationResult = {
  errors: string[];
  linkCount: number;
};

function formatValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function extractWikilinkEntries(content: string): WikiLink[] {
  return parseWikilinks(content);
}

function extractAnchorIndex(content: string): AnchorIndex {
  const lines = content.split('\n');
  const headings = new Set(
    lines
      .map(line => line.match(/^#{1,6}\s+(.+)$/)?.[1] ?? '')
      .filter(Boolean)
      .map(normalizeHeadingToAnchor)
  );
  const blocks = new Set(lines.map(line => line.match(BLOCK_MARKER_PATTERN)?.[1] ?? '').filter(Boolean));

  return { headings, blocks };
}

function getMdxSlugsInDir(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getMdxSlugsInDir(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.mdx')) {
      results.push(entry.name.replace(/\.mdx$/, ''));
    }
  }

  return results;
}
function parseNoteFile(filePath: string): NoteFile {
  const { data, content } = matter(fs.readFileSync(filePath, 'utf-8'));
  return { frontmatter: data, content };
}

function normalizeParent(parent: unknown): string | undefined {
  return typeof parent === 'string' && parent.trim().length > 0 ? parent.trim() : undefined;
}

function findFilePath(baseDir: string, slug: string): string | null {
  const exts = ['.mdx'];
  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const found = findFilePath(path.join(baseDir, entry.name), slug);
      if (found) return found;
    } else if (entry.isFile()) {
      for (const ext of exts) {
        if (entry.name === `${slug}${ext}`) {
          return path.join(baseDir, entry.name);
        }
      }
    }
  }
  return null;
}

function arraysHaveSameElements(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;

  const sorted = (arr: unknown[]) => [...arr].toSorted();
  return sorted(a).every((val, idx) => val === sorted(b)[idx]);
}

function generateSummary(errors: string[], warnings: string[], stats: ValidationStats): string {
  const lines: string[] = [];

  lines.push('## Garden Content Validation\n');

  if (errors.length === 0) {
    lines.push('### ✅ All checks passed!\n');
    lines.push(`- **Notes validated**: ${stats.totalNotes}`);
    lines.push(`- **Wikilinks checked**: ${stats.totalLinks}`);
    lines.push(`- **Languages**: ${LANGUAGES.join(', ')}\n`);
  } else {
    lines.push('### ❌ Validation failed\n');
  }

  if (errors.length > 0) {
    lines.push('<details>');
    lines.push(`<summary>🚨 Errors (${errors.length})</summary>\n`);
    lines.push('| Type | File | Details |');
    lines.push('|------|------|---------|');

    for (const error of errors) {
      const match = error.match(/\[([^\]]+)\]\s*(.+)/);
      if (match) {
        const [, file = '-', rawDetail = error] = match;
        const detail = rawDetail.replace(/\|/g, '\\|');
        lines.push(`| Error | \`${file}\` | ${detail} |`);
      } else {
        lines.push(`| Error | - | ${error} |`);
      }
    }

    lines.push('\n</details>\n');
  }

  if (warnings.length > 0) {
    lines.push('<details>');
    lines.push(`<summary>⚠️ Warnings (${warnings.length})</summary>\n`);
    lines.push('| File | Details |');
    lines.push('|------|---------|');

    for (const warning of warnings) {
      const match = warning.match(/\[([^\]]+)\]\s*(.+)/);
      if (match) {
        const [, file = '-', rawDetail = warning] = match;
        lines.push(`| \`${file}\` | ${rawDetail.replace(/\|/g, '\\|')} |`);
      }
    }

    lines.push('\n</details>\n');
  }

  return lines.join('\n');
}

function collectFilesByLanguage(): Record<Language, Set<string>> {
  const filesByLang = {} as Record<Language, Set<string>>;

  for (const lang of LANGUAGES) {
    const gardenPath = path.join(CONTENT_DIR, lang, GARDEN_DIR);
    filesByLang[lang] = new Set(getMdxSlugsInDir(gardenPath));
  }

  return filesByLang;
}

function checkLanguageSync(
  filesByLang: Record<Language, Set<string>>,
  primaryFiles: Set<string>,
  secondaryLangs: Language[]
): string[] {
  const warnings: string[] = [];

  for (const file of primaryFiles) {
    for (const lang of secondaryLangs) {
      if (!filesByLang[lang].has(file)) {
        warnings.push(`[${PRIMARY_LANG}/${file}] "${file}" 노트가 [${lang}]에 없습니다.`);
      }
    }
  }

  for (const lang of secondaryLangs) {
    for (const file of filesByLang[lang]) {
      if (!primaryFiles.has(file)) {
        warnings.push(`[${lang}/${file}] "${file}" 노트가 [${PRIMARY_LANG}]에 없습니다.`);
      }
    }
  }

  return warnings;
}

function validateNote(lang: Language, slug: string, existingSlugs: Set<string>): ValidationResult {
  const errors: string[] = [];
  const baseDir = path.join(CONTENT_DIR, lang, GARDEN_DIR);
  const filePath = findFilePath(baseDir, slug);

  if (!filePath) {
    return { errors: [`[${lang}/${slug}] 파일을 찾을 수 없습니다.`], linkCount: 0 };
  }

  let parsed;
  try {
    parsed = parseNoteFile(filePath);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { errors: [`[${lang}/${slug}] 파일 파싱 실패: ${message}`], linkCount: 0 };
  }

  const { frontmatter, content } = parsed;

  REQUIRED_FIELDS.filter(field => !frontmatter[field]).forEach(field =>
    errors.push(`[${lang}/${slug}] 필수 필드 누락: ${field}`)
  );

  if (frontmatter.status && (typeof frontmatter.status !== 'string' || !VALID_STATUS_SET.has(frontmatter.status))) {
    errors.push(
      `[${lang}/${slug}] 유효하지 않은 status: "${formatValue(frontmatter.status)}" (허용: ${VALID_STATUSES.join(', ')})`
    );
  }

  const parent = normalizeParent(frontmatter.parent);
  if (parent) {
    if (parent === slug) {
      errors.push(`[${lang}/${slug}] 유효하지 않은 parent: 자기 자신("${parent}")을 parent로 지정할 수 없습니다.`);
    } else if (!existingSlugs.has(parent)) {
      errors.push(`[${lang}/${slug}] 유효하지 않은 parent: "${parent}" (존재하지 않는 노트)`);
    }
  }

  const wikilinks = extractWikilinkEntries(content);
  const anchorCache = new Map<string, AnchorIndex | null>();
  const getAnchorsForSlug = (targetSlug: string): AnchorIndex | null => {
    if (anchorCache.has(targetSlug)) {
      return anchorCache.get(targetSlug) ?? null;
    }

    const targetPath = findFilePath(baseDir, targetSlug);
    if (!targetPath) {
      anchorCache.set(targetSlug, null);
      return null;
    }

    const target = parseNoteFile(targetPath);
    const index = extractAnchorIndex(target.content);
    anchorCache.set(targetSlug, index);
    return index;
  };

  for (const link of wikilinks) {
    const targetSlug = link.slug || slug;

    if (!existingSlugs.has(targetSlug)) {
      errors.push(`[${lang}/${slug}] 깨진 위키링크: [[${link.target}]] (존재하지 않는 노트)`);
      continue;
    }

    if (!link.heading && !link.blockId) {
      continue;
    }

    const anchors = getAnchorsForSlug(targetSlug);
    if (!anchors) {
      errors.push(`[${lang}/${slug}] 깨진 위키링크: [[${link.target}]] (대상 노트를 읽을 수 없음)`);
      continue;
    }

    if (link.heading && !anchors.headings.has(normalizeHeadingToAnchor(link.heading))) {
      errors.push(`[${lang}/${slug}] 깨진 헤딩 링크: [[${link.target}]] (헤딩 없음)`);
    }

    if (link.blockId && !anchors.blocks.has(link.blockId)) {
      errors.push(`[${lang}/${slug}] 깨진 블록 링크: [[${link.target}]] (블록 없음)`);
    }
  }

  return { errors, linkCount: wikilinks.length };
}

function checkFrontmatterConsistency(commonFiles: string[], secondaryLangs: Language[]): string[] {
  const warnings: string[] = [];

  for (const slug of commonFiles) {
    const frontmatters: Partial<Record<Language, Frontmatter>> = {};

    for (const lang of LANGUAGES) {
      try {
        const baseDir = path.join(CONTENT_DIR, lang, GARDEN_DIR);
        const filePath = findFilePath(baseDir, slug);
        if (filePath) {
          frontmatters[lang] = parseNoteFile(filePath).frontmatter;
        }
      } catch {
        // 파싱 실패는 validateNote에서 이미 처리됨
      }
    }

    if (Object.keys(frontmatters).length !== LANGUAGES.length) continue;

    const primaryFm = frontmatters[PRIMARY_LANG];
    if (!primaryFm) continue;

    for (const lang of secondaryLangs) {
      const secondaryFm = frontmatters[lang];
      if (!secondaryFm) continue;

      if (!arraysHaveSameElements(primaryFm.tags, secondaryFm.tags)) {
        warnings.push(
          `[${slug}] tags 불일치: [${PRIMARY_LANG}]=${JSON.stringify(primaryFm.tags)} vs [${lang}]=${JSON.stringify(secondaryFm.tags)}`
        );
      }

      if (primaryFm.status !== secondaryFm.status) {
        warnings.push(
          `[${slug}] status 불일치: [${PRIMARY_LANG}]="${primaryFm.status}" vs [${lang}]="${secondaryFm.status}"`
        );
      }
    }
  }

  return warnings;
}

function checkParentConsistency(commonFiles: string[], secondaryLangs: Language[]): string[] {
  const errors: string[] = [];

  for (const slug of commonFiles) {
    const parents: Partial<Record<Language, string | undefined>> = {};

    for (const lang of LANGUAGES) {
      try {
        const baseDir = path.join(CONTENT_DIR, lang, GARDEN_DIR);
        const filePath = findFilePath(baseDir, slug);
        if (filePath) {
          const frontmatter = parseNoteFile(filePath).frontmatter;
          parents[lang] = normalizeParent(frontmatter.parent);
        }
      } catch {
        // 파싱 실패는 validateNote에서 이미 처리됨
      }
    }

    if (Object.keys(parents).length !== LANGUAGES.length) continue;

    const primaryParent = parents[PRIMARY_LANG];
    for (const lang of secondaryLangs) {
      const secondaryParent = parents[lang];
      if (primaryParent !== secondaryParent) {
        errors.push(
          `[${slug}] parent 불일치: [${PRIMARY_LANG}]=${JSON.stringify(primaryParent)} vs [${lang}]=${JSON.stringify(secondaryParent)}`
        );
      }
    }
  }

  return errors;
}

function printResults(errors: string[], warnings: string[], stats: ValidationStats): void {
  console.log('━'.repeat(50));

  if (warnings.length > 0) {
    console.log('\n⚠️  경고:\n');
    warnings.forEach(w => console.log(`  ${w}`));
  }

  if (errors.length > 0) {
    console.log('\n❌ 오류:\n');
    errors.forEach(e => console.log(`  ${e}`));
    console.log(`\n총 ${errors.length}개의 오류가 발견되었습니다.\n`);
    process.exit(1);
  }

  console.log('\n✅ 모든 가든 콘텐츠 검증 통과!\n');
  console.log(`  - 검증된 노트: ${stats.totalNotes}개`);
  console.log(`  - 검증된 위키링크: ${stats.totalLinks}개`);
  console.log(`  - 지원 언어: ${LANGUAGES.join(', ')}\n`);
}

function validateGarden(): void {
  const filesByLang = collectFilesByLanguage();
  const primaryFiles = filesByLang[PRIMARY_LANG];
  const secondaryLangs = LANGUAGES.filter(l => l !== PRIMARY_LANG);

  const warnings = checkLanguageSync(filesByLang, primaryFiles, secondaryLangs);

  if (!OUTPUT_SUMMARY) {
    console.log('\n📁 파일 존재 여부 검증...\n');
    console.log('📝 Frontmatter 및 위키링크 검증...\n');
  }

  const stats = { totalNotes: 0, totalLinks: 0 };
  const errors: string[] = [];

  for (const lang of LANGUAGES) {
    const existingSlugs = filesByLang[lang];

    for (const slug of existingSlugs) {
      stats.totalNotes++;
      const result = validateNote(lang, slug, existingSlugs);
      errors.push(...result.errors);
      stats.totalLinks += result.linkCount;
    }
  }

  const commonFiles = [...primaryFiles].filter(file => secondaryLangs.every(lang => filesByLang[lang].has(file)));
  warnings.push(...checkFrontmatterConsistency(commonFiles, secondaryLangs));
  errors.push(...checkParentConsistency(commonFiles, secondaryLangs));

  if (OUTPUT_SUMMARY) {
    console.log(generateSummary(errors, warnings, stats));
    process.exit(errors.length > 0 ? 1 : 0);
  }

  printResults(errors, warnings, stats);
}

validateGarden();

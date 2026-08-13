#!/usr/bin/env node

import fs from 'fs';
import matter from 'gray-matter';
import path from 'path';
import { fileURLToPath } from 'url';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirname = path.dirname(currentFilePath);

const CONTENT_DIR = path.join(currentDirname, '../content');
const LANGUAGES = ['ko', 'en'];
const PRIMARY_LANG = 'ko';
const OUTPUT_SUMMARY = process.argv.includes('--summary');

function getMdxFilesRecursive(dir, baseDir = dir) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  return entries.flatMap(entry => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return getMdxFilesRecursive(fullPath, baseDir);
    }
    if (entry.isFile() && entry.name.endsWith('.mdx')) {
      return [path.relative(baseDir, fullPath)];
    }
    return [];
  });
}

function parseFrontmatter(filePath) {
  return matter(fs.readFileSync(filePath, 'utf-8')).data;
}

function arraysHaveSameElements(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;

  const sorted = arr => [...arr].toSorted();
  return sorted(a).every((val, idx) => val === sorted(b)[idx]);
}

function generateSummary(errors, warnings, commonFiles) {
  const lines = [];

  lines.push('## Blog Content Validation\n');

  if (errors.length === 0) {
    lines.push('### ✅ All checks passed!\n');
    lines.push(`- **Files validated**: ${commonFiles.length}`);
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
        const file = match[1];
        const detail = match[2].replace(/\|/g, '\\|');
        const type = error.includes('파일이') ? 'Missing file' : 'Mismatch';
        lines.push(`| ${type} | \`${file}\` | ${detail} |`);
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
        lines.push(`| \`${match[1]}\` | ${match[2].replace(/\|/g, '\\|')} |`);
      }
    }

    lines.push('\n</details>\n');
  }

  if (errors.length === 0 && commonFiles.length > 0) {
    lines.push('<details>');
    lines.push(`<summary>📁 Validated files (${commonFiles.length})</summary>\n`);

    for (const file of commonFiles.toSorted()) {
      lines.push(`- \`${file}\``);
    }

    lines.push('\n</details>');
  }

  return lines.join('\n');
}

function collectFilesByLanguage() {
  return LANGUAGES.reduce((acc, lang) => {
    acc[lang] = new Set(getMdxFilesRecursive(path.join(CONTENT_DIR, lang)));
    return acc;
  }, {});
}

function checkLanguageSync(filesByLang, primaryFiles, secondaryLangs) {
  const errors = [];

  for (const file of primaryFiles) {
    for (const lang of secondaryLangs) {
      if (!filesByLang[lang].has(file)) {
        errors.push(`[${PRIMARY_LANG}] "${file}" 파일이 [${lang}]에 없습니다.`);
      }
    }
  }

  for (const lang of secondaryLangs) {
    for (const file of filesByLang[lang]) {
      if (!primaryFiles.has(file)) {
        errors.push(`[${lang}] "${file}" 파일이 [${PRIMARY_LANG}]에 없습니다.`);
      }
    }
  }

  return errors;
}

function validateFrontmatter(file, secondaryLangs) {
  const errors = [];
  const warnings = [];

  const frontmatters = LANGUAGES.reduce((acc, lang) => {
    try {
      acc[lang] = parseFrontmatter(path.join(CONTENT_DIR, lang, file));
    } catch (e) {
      errors.push(`[${lang}/${file}] frontmatter 파싱 실패: ${e.message}`);
    }
    return acc;
  }, {});

  if (Object.keys(frontmatters).length !== LANGUAGES.length) {
    return { errors, warnings };
  }

  const primaryFm = frontmatters[PRIMARY_LANG];

  for (const lang of secondaryLangs) {
    const secondaryFm = frontmatters[lang];

    if (primaryFm.date !== secondaryFm.date) {
      errors.push(`[${file}] date 불일치: [${PRIMARY_LANG}]="${primaryFm.date}" vs [${lang}]="${secondaryFm.date}"`);
    }

    if (!arraysHaveSameElements(primaryFm.tags, secondaryFm.tags)) {
      errors.push(
        `[${file}] tags 불일치: [${PRIMARY_LANG}]=${JSON.stringify(primaryFm.tags)} vs [${lang}]=${JSON.stringify(secondaryFm.tags)}`
      );
    }

    if (primaryFm.draft !== secondaryFm.draft) {
      warnings.push(`[${file}] draft 불일치: [${PRIMARY_LANG}]=${primaryFm.draft} vs [${lang}]=${secondaryFm.draft}`);
    }

    // series 이름은 로케일마다 다른 게 의도지만(표시 이름 그 자체다), 편 번호가
    // 갈리면 한쪽 로케일의 시리즈 순서가 통째로 어긋난다. 실제로 en 2부에 3이
    // 들어간 적이 있고 스키마·테스트 어느 쪽도 잡지 못했다.
    if (primaryFm.part !== secondaryFm.part) {
      errors.push(`[${file}] part 불일치: [${PRIMARY_LANG}]=${primaryFm.part} vs [${lang}]=${secondaryFm.part}`);
    }

    if ((primaryFm.series === undefined) !== (secondaryFm.series === undefined)) {
      errors.push(
        `[${file}] series 유무 불일치: [${PRIMARY_LANG}]=${primaryFm.series} vs [${lang}]=${secondaryFm.series}`
      );
    }
  }

  return { errors, warnings };
}

function printResults(errors, warnings, commonFiles) {
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

  console.log('\n✅ 모든 콘텐츠 검증 통과!\n');
  console.log(`  - 검증된 파일: ${commonFiles.length}개`);
  console.log(`  - 지원 언어: ${LANGUAGES.join(', ')}\n`);
}

function validateContent() {
  const filesByLang = collectFilesByLanguage();
  const primaryFiles = filesByLang[PRIMARY_LANG];
  const secondaryLangs = LANGUAGES.filter(l => l !== PRIMARY_LANG);

  if (!OUTPUT_SUMMARY) {
    console.log('\n📁 파일 존재 여부 검증...\n');
    console.log('📝 Frontmatter 검증...\n');
  }

  const syncErrors = checkLanguageSync(filesByLang, primaryFiles, secondaryLangs);

  const commonFiles = [...primaryFiles].filter(file => secondaryLangs.every(lang => filesByLang[lang].has(file)));

  const { errors: fmErrors, warnings } = commonFiles.reduce(
    (acc, file) => {
      const result = validateFrontmatter(file, secondaryLangs);
      acc.errors.push(...result.errors);
      acc.warnings.push(...result.warnings);
      return acc;
    },
    { errors: [], warnings: [] }
  );

  const errors = [...syncErrors, ...fmErrors];

  if (OUTPUT_SUMMARY) {
    console.log(generateSummary(errors, warnings, commonFiles));
    process.exit(errors.length > 0 ? 1 : 0);
  }

  printResults(errors, warnings, commonFiles);
}

validateContent();

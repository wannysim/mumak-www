#!/usr/bin/env node

/**
 * 벤더링된 프로젝트 스킬의 내용 고정(lock) 검증 스크립트
 *
 * `.ai/skills/` 중 외부에서 가져온 스킬은 `skills-lock.json`에 등재하고
 * 내용 해시를 함께 기록한다. 로컬에서 의도치 않게 수정되거나, upstream을
 * 다시 받아 덮어썼을 때 CI에서 잡는다.
 *
 * 해시 정의:
 *   sha256( 각 파일마다 [스킬 디렉터리 기준 상대경로] + NUL + [파일 바이트] 를
 *           경로 오름차순으로 이어붙인 것 )
 *   - 바이너리(assets/*.png) 포함, 디렉터리 구조와 파일명 변경도 감지한다.
 *   - 경로 구분자는 항상 `/`로 정규화해 OS 간 결과가 같다.
 *
 * 사용법:
 *   node scripts/validate-skills.mjs           # 검증만 (불일치 시 exit 1)
 *   node scripts/validate-skills.mjs --write   # 현재 내용으로 해시 갱신
 *
 * 의도적으로 벤더링 스킬을 수정했다면 `--write`로 갱신하고, 무엇을 왜
 * 바꿨는지 해당 항목의 `localChanges`에 적는다.
 *
 * 주의: 루트 `format:root:fix`(oxfmt)와 lint-staged가 스킬 디렉터리의 markdown도
 * 포맷한다. upstream에서 다시 받아오면 포맷 diff가 먼저 생기므로,
 * 포맷을 적용한 뒤 마지막에 `--write`로 해시를 갱신한다.
 */

import { createHash } from 'crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { dirname, join, relative, sep } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const SKILLS_DIR = join(ROOT_DIR, '.ai', 'skills');
const LOCK_PATH = join(ROOT_DIR, 'skills-lock.json');

const WRITE_MODE = process.argv.includes('--write');

/**
 * 디렉터리 하위의 모든 파일 경로를 재귀적으로 수집
 */
function collectFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * 스킬 디렉터리의 내용 해시를 계산
 */
function computeSkillHash(skillDir) {
  const hash = createHash('sha256');
  const files = collectFiles(skillDir)
    .map(file => relative(skillDir, file).split(sep).join('/'))
    .toSorted();

  for (const relativePath of files) {
    hash.update(relativePath);
    hash.update('\0');
    hash.update(readFileSync(join(skillDir, relativePath)));
  }

  return hash.digest('hex');
}

function skillExists(name) {
  try {
    return statSync(join(SKILLS_DIR, name)).isDirectory();
  } catch {
    return false;
  }
}

const lock = JSON.parse(readFileSync(LOCK_PATH, 'utf-8'));
const entries = Object.entries(lock.skills ?? {});

if (entries.length === 0) {
  console.error('skills-lock.json에 등재된 스킬이 없습니다.');
  process.exit(1);
}

const problems = [];
const updated = [];

for (const [name, entry] of entries) {
  if (!skillExists(name)) {
    problems.push(`${name}: 등재돼 있지만 .ai/skills/${name}/ 가 없습니다.`);
    continue;
  }

  const actual = computeSkillHash(join(SKILLS_DIR, name));

  if (WRITE_MODE) {
    if (entry.computedHash !== actual) {
      updated.push(name);
      entry.computedHash = actual;
    }
    continue;
  }

  if (entry.computedHash !== actual) {
    problems.push(`${name}: 내용이 lock과 다릅니다.\n` + `    기록: ${entry.computedHash}\n` + `    실제: ${actual}`);
  }
}

if (WRITE_MODE) {
  writeFileSync(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`);
  console.log(
    updated.length > 0 ? `skills-lock.json 갱신: ${updated.join(', ')}` : 'skills-lock.json 변경 없음 (이미 최신)'
  );
  process.exit(0);
}

if (problems.length > 0) {
  console.error('벤더링 스킬 검증 실패:\n');
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  console.error(
    '\n의도한 변경이면 `pnpm validate:skills:write`로 해시를 갱신하고,' +
      '\n무엇을 왜 바꿨는지 skills-lock.json의 localChanges에 적으세요.'
  );
  process.exit(1);
}

console.log(`벤더링 스킬 ${entries.length}개 검증 통과.`);

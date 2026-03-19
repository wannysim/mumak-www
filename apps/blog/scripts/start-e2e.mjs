#!/usr/bin/env node
/**
 * E2E 테스트용 서버 시작 스크립트
 * output: standalone 빌드 시 next start 대신 standalone server 사용
 * @see https://nextjs.org/docs/app/api-reference/next-config-js/output
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const blogRoot = path.join(__dirname, '..');
const standaloneDir = path.join(blogRoot, '.next/standalone/apps/blog');
const serverPath = path.join(standaloneDir, 'server.js');

const isCI = process.env.CI === 'true' || process.env.CI === '1';
const port = '3002';
const env = { ...process.env, PORT: port, E2E_INCLUDE_DRAFT: process.env.E2E_INCLUDE_DRAFT ?? 'true' };

// standalone 빌드가 있으면 해당 서버 사용, 없으면 next start
const useStandalone = fs.existsSync(serverPath);

if (useStandalone) {
  const sourceStaticDir = path.join(blogRoot, '.next/static');
  const targetStaticDir = path.join(standaloneDir, '.next/static');

  // Next standalone 실행 시 정적 리소스(.next/static)가 누락될 수 있어 e2e 전 동기화
  if (fs.existsSync(sourceStaticDir) && !fs.existsSync(targetStaticDir)) {
    fs.mkdirSync(path.dirname(targetStaticDir), { recursive: true });
    fs.cpSync(sourceStaticDir, targetStaticDir, { recursive: true });
  }

  const proc = spawn('node', ['server.js'], {
    cwd: standaloneDir,
    env,
    stdio: 'inherit',
  });
  proc.on('exit', code => process.exit(code ?? 0));
} else {
  if (isCI) {
    console.error(
      '[start:e2e] standalone server가 없습니다. CI에서는 `pnpm turbo run build --filter=blog` 이후 `.next/standalone/apps/blog/server.js`가 생성되어야 합니다.'
    );
    process.exit(1);
  }

  const proc = spawn('pnpm', ['exec', 'next', 'start', '--port', port], {
    cwd: blogRoot,
    env,
    stdio: 'inherit',
  });
  proc.on('exit', code => process.exit(code ?? 0));
}

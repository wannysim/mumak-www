#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const adminRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const standaloneRoot = path.join(adminRoot, '.next/standalone/apps/admin');
const serverPath = path.join(standaloneRoot, 'server.js');

if (!fs.existsSync(serverPath)) {
  console.error('[start:e2e] Run `pnpm --filter admin build` before starting the standalone E2E server.');
  process.exit(1);
}

const sourceStatic = path.join(adminRoot, '.next/static');
const targetStatic = path.join(standaloneRoot, '.next/static');
if (fs.existsSync(sourceStatic) && !fs.existsSync(targetStatic)) {
  fs.mkdirSync(path.dirname(targetStatic), { recursive: true });
  fs.cpSync(sourceStatic, targetStatic, { recursive: true });
}

const server = spawn('node', ['server.js'], {
  cwd: standaloneRoot,
  env: { ...process.env, HOSTNAME: '127.0.0.1', PORT: '3006' },
  stdio: 'inherit',
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.kill(signal));
}
server.on('exit', code => process.exit(code ?? 0));

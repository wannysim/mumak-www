import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    css: true,
    // setup.ts의 asyncUtilTimeout(5000ms)과 기본 testTimeout(5000ms)이 같으면, 병렬 부하에서 waitFor가
    // 실패 메시지를 내기 전에 테스트 타임아웃이 먼저 터진다. 대기 한도보다 넉넉하게 둔다.
    testTimeout: 15_000,
    exclude: ['**/e2e/**', '**/node_modules/**'],
    // CI에서는 github-actions reporter를 추가해 실패 테스트가 PR 라인 annotation으로 노출되도록 한다.
    reporters: process.env.GITHUB_ACTIONS === 'true' ? ['default', 'github-actions'] : ['default'],
    // 회귀 방지용 baseline. main.tsx(앱 부트스트랩)는 E2E로 커버되므로 제외.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/**/__tests__/**', 'src/main.tsx', 'src/test/**'],
      // CI step summary가 coverage-summary.json을 jq로 파싱하므로 json-summary 리포트 추가.
      reporter: ['text', 'json', 'json-summary', 'lcov'],
      thresholds: {
        branches: 80,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
});

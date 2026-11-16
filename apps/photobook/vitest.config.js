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
    globals: true,
    // CI에서는 github-actions reporter를 추가해 실패 테스트가 PR 라인 annotation으로 노출되도록 한다.
    reporters: process.env.GITHUB_ACTIONS === 'true' ? ['default', 'github-actions'] : ['default'],
    // 순수 동작 규칙(src/model)은 node 환경에서 돌려 window·document 의존을 막는다(spikes.md "단위 테스트 경계").
    projects: [
      {
        extends: true,
        test: {
          name: 'model',
          environment: 'node',
          include: ['src/model/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          css: true,
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/model/**', '**/e2e/**', '**/node_modules/**'],
        },
      },
    ],
    // 회귀 방지용 baseline. main.tsx(앱 부트스트랩)는 E2E로 커버되므로 제외.
    // src/render는 WebGL·래스터 코드라 jsdom에서 돌지 않는다. E2E와 스파이크 실기기로 덮는다.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/**/__tests__/**', 'src/main.tsx', 'src/test/**', 'src/render/**'],
      // CI step summary가 coverage-summary.json을 jq로 파싱하므로 json-summary 리포트 추가.
      reporter: ['text', 'json', 'json-summary', 'lcov'],
      thresholds: {
        branches: 80,
        functions: 90,
        lines: 90,
        statements: 90,
        'src/model/**': {
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95,
        },
      },
    },
  },
});

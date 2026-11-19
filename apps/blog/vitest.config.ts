import react from '@vitejs/plugin-react';
import path from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';

const testFiles = '**/__tests__/**/*.test.{js,jsx,ts,tsx}';
const buildTests = '__tests__/build/**/*.test.{js,jsx,ts,tsx}';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': import.meta.dirname,
      '@mumak/ui': path.resolve(import.meta.dirname, '../../packages/ui/src'),
    },
  },
  test: {
    globals: true,
    // Jest처럼 개별 테스트에서 명시적으로 초기화할 때까지 호출 기록을 유지한다.
    clearMocks: false,
    reporters: process.env.GITHUB_ACTIONS === 'true' ? ['default', 'github-actions'] : ['default'],
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'jsdom',
          environmentOptions: { jsdom: { url: 'http://localhost' } },
          setupFiles: ['./vitest.setup.ts'],
          include: [testFiles],
          exclude: [...configDefaults.exclude, '**/.next/**', '**/e2e/**', buildTests],
        },
      },
      {
        test: {
          name: 'static',
          environment: 'node',
          include: [buildTests],
        },
      },
      // Storybook의 테스트 패널도 루트 설정에서 이 브라우저 프로젝트를 찾는다.
      './vitest.storybook.config.ts',
    ],
    coverage: {
      provider: 'v8',
      reportOnFailure: true,
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: ['**/*.d.ts', '**/__tests__/**', '**/index.ts', 'src/shared/config/**', 'src/app/analytics/**'],
      reporter: ['json', 'lcov', 'text', 'clover', 'json-summary'],
      thresholds: {
        branches: 78,
        functions: 88,
        lines: 92,
        statements: 91,
      },
    },
  },
});

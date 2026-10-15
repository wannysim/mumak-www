import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  outputDir: '../test-results/focus-lab',
  use: { baseURL: 'http://127.0.0.1:6007', viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' },
  webServer: {
    command: 'pnpm exec storybook dev --ci --host 127.0.0.1 --port 6007 --no-open',
    cwd: new URL('..', import.meta.url).pathname,
    url: 'http://127.0.0.1:6007',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});

import { defineConfig } from '@playwright/test';

// CI는 `storybook build --test` 정적 산출물을 서빙한다. dev 서버의 첫 컴파일·HMR 지연이 측정·포커스
// 검증과 경합하지 않게 하기 위해서다. 로컬은 수정 반영이 빠른 dev 서버를 그대로 쓴다.
const isCI = !!process.env.CI;
const port = 6007;
const command = isCI
  ? `pnpm exec storybook build --test -o storybook-static --quiet && pnpm exec vite preview --outDir storybook-static --host 127.0.0.1 --port ${port} --strictPort`
  : `pnpm exec storybook dev --ci --host 127.0.0.1 --port ${port} --no-open`;

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  outputDir: '../test-results/focus-lab',
  forbidOnly: isCI,
  reporter: isCI ? [['github'], ['list']] : 'list',
  use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' },
  webServer: {
    env: { STORYBOOK_BROWSER_TEST: '1' },
    command,
    cwd: new URL('..', import.meta.url).pathname,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: isCI ? 180_000 : 60_000,
  },
});

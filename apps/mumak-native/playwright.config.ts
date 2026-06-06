import { defineConfig, devices } from '@playwright/test';

const PORT = 3003;
const isCI = !!process.env.CI;
const shouldReuseExistingServer =
  process.env.PLAYWRIGHT_REUSE_SERVER === 'true' || process.env.PLAYWRIGHT_REUSE_SERVER === '1';

function createWebServerEnv(extraEnv: Record<string, string> = {}): Record<string, string> {
  const env = Object.fromEntries(
    Object.entries({ ...process.env, ...extraEnv }).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  );

  if ((env.CI || env.FORCE_COLOR) && env.NO_COLOR) {
    env.NO_COLOR = '';
  }

  return env;
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : '50%',
  reporter: isCI ? [['html'], ['github']] : 'list',
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: isCI
    ? [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
      ]
    : [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm preview:e2e',
    env: createWebServerEnv(),
    url: `http://localhost:${PORT}`,
    reuseExistingServer: shouldReuseExistingServer,
    timeout: 180_000, // expo export(최초)가 느릴 수 있어 여유
  },
});

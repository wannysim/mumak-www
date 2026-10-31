import { devices } from '@playwright/test';
import { createHash, randomBytes } from 'node:crypto';

import { createPlaywrightConfig } from '@mumak/playwright-config/create-playwright-config';

const config = createPlaywrightConfig({
  port: 3008,
  command: 'pnpm start:e2e',
  extraEnv: {
    INTERVIEW_ORIGIN: 'http://localhost:3008',
    INTERVIEW_TOKEN_SHA256: createHash('sha256').update('e2e-only-key-never-for-production-12345678').digest('hex'),
    INTERVIEW_SESSION_SECRET: randomBytes(32).toString('hex'),
  },
});
export default {
  ...config,
  workers: 2,
  projects: [
    ...(config.projects ?? []),
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'], defaultBrowserType: 'webkit' as const } },
  ],
};

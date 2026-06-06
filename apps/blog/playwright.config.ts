import { createPlaywrightConfig } from '@mumak/playwright-config/create-playwright-config';

export default createPlaywrightConfig({
  port: 3002,
  command: 'pnpm start:e2e',
  // CI 안정성을 위해 블로그는 브라우저 job당 worker를 1로 줄인다.
  ciWorkers: 1,
  extraEnv: {
    E2E_INCLUDE_DRAFT: '1',
  },
});

import { createPlaywrightConfig } from '@mumak/playwright-config/create-playwright-config';

export default createPlaywrightConfig({
  port: 3006,
  command: 'pnpm start:e2e',
});

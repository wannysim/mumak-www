import { createPlaywrightConfig } from '@mumak/playwright-config/create-playwright-config';

export default createPlaywrightConfig({
  port: 3007,
  command: 'pnpm preview:e2e',
});

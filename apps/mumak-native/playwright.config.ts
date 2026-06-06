import { createPlaywrightConfig } from '@mumak/playwright-config/create-playwright-config';

export default createPlaywrightConfig({
  port: 3003,
  command: 'pnpm preview:e2e',
  // expo export(최초)가 느릴 수 있어 여유
  webServerTimeout: 180_000,
});

import { devices, type PlaywrightTestConfig } from '@playwright/test';

import { createPlaywrightConfig } from '@mumak/playwright-config/create-playwright-config';

const base = createPlaywrightConfig({
  port: 3005,
  command: 'pnpm preview:e2e',
});

// 터치 스크롤·탭 센터링·safe area는 터치 디바이스에서만 의미가 있다.
// 공통 factory는 데스크톱 매트릭스를 고정하므로, 문서화된 호출부 override로 프로젝트를 덧붙인다.
const MOBILE_ONLY = /mobile\.spec\.ts/;

const config: PlaywrightTestConfig = {
  ...base,
  projects: [
    ...(base.projects ?? []).map(project => ({ ...project, testIgnore: MOBILE_ONLY })),
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
      testMatch: MOBILE_ONLY,
    },
  ],
};

export default config;

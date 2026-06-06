import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

type CreatePlaywrightConfigOptions = {
  /** E2E 서버 포트. baseURL과 webServer.url 모두에 사용된다. */
  port: number;
  /** webServer를 띄우는 명령. 예: 'pnpm start:e2e' | 'pnpm preview:e2e' */
  command: string;
  /** CI에서 브라우저 job당 worker 수. 로컬은 항상 '50%'. */
  ciWorkers?: number;
  /** webServer 기동 타임아웃(ms). expo export처럼 느린 빌드는 늘린다. */
  webServerTimeout?: number;
  /** webServer 프로세스에 추가로 주입할 env. 예: { E2E_INCLUDE_DRAFT: '1' } */
  extraEnv?: Record<string, string>;
};

const isCI = !!process.env.CI;
const shouldReuseExistingServer =
  process.env.PLAYWRIGHT_REUSE_SERVER === 'true' || process.env.PLAYWRIGHT_REUSE_SERVER === '1';

/**
 * CI/FORCE_COLOR 환경에서 NO_COLOR가 함께 전달되면 Node가 반복 warning을 출력한다.
 * 색을 유지하기로 한 맥락(CI/FORCE_COLOR)에서는 충돌하는 NO_COLOR를 제거한다.
 * @see https://github.com/aptmtr/mumak-www/issues/385
 */
function createWebServerEnv(extraEnv: Record<string, string>): Record<string, string> {
  const env = Object.fromEntries(
    Object.entries({ ...process.env, ...extraEnv }).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  );

  if ((env.CI || env.FORCE_COLOR) && env.NO_COLOR) {
    delete env.NO_COLOR;
  }

  return env;
}

/**
 * 모노레포 앱 공통 Playwright 설정 factory.
 *
 * 앱마다 달라지는 표면(port/command/ciWorkers/webServerTimeout/extraEnv)만 옵션으로 받고
 * 나머지(projects 매트릭스, reporter, retries, trace, reuse 로직)는 단일 소스로 고정한다.
 *
 * 반환값은 일반 config 객체이므로, 드물게 추가 커스터마이즈가 필요하면 호출부에서 spread로 override할 수 있다.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export function createPlaywrightConfig({
  port,
  command,
  ciWorkers = 2,
  webServerTimeout = 120_000,
  extraEnv = {},
}: CreatePlaywrightConfigOptions): PlaywrightTestConfig {
  return defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    /* CI에서 test.only를 실수로 남기면 실패시킨다. */
    forbidOnly: isCI,
    /* CI에서만 재시도 */
    retries: isCI ? 2 : 0,
    /* 로컬은 빠른 피드백을 위해 '50%' */
    workers: isCI ? ciWorkers : '50%',
    reporter: isCI ? [['html'], ['github']] : 'list',
    timeout: 30_000,
    use: {
      baseURL: `http://localhost:${port}`,
      /* 재시도 시에만 trace 수집 */
      trace: 'on-first-retry',
      actionTimeout: 10_000,
      navigationTimeout: 15_000,
    },
    /* CI는 크로스 브라우저 전부, 로컬은 빠른 피드백용 chromium만 */
    projects: isCI
      ? [
          { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
          { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        ]
      : [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
      command,
      env: createWebServerEnv(extraEnv),
      url: `http://localhost:${port}`,
      // Reuse는 opt-in. 떠 있는 stale 서버에 실수로 붙는 것을 막는다.
      reuseExistingServer: shouldReuseExistingServer,
      timeout: webServerTimeout,
    },
  });
}

import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
});

// In CI we add the github-actions reporter so failing tests surface as
// PR-line annotations. Locally we keep the default reporter for clean output.
const reporters = process.env.GITHUB_ACTIONS === 'true' ? ['default', 'github-actions'] : ['default'];

// Add any custom config to be passed to Jest
const customJestConfig = {
  reporters,
  // CI step summary가 coverage-summary.json을 jq로 파싱하므로 json-summary 리포트 추가.
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@mumak/ui/(.*)$': '<rootDir>/../../packages/ui/src/$1',
  },
  transformIgnorePatterns: ['/node_modules/(?!(next-intl|use-intl|@formatjs)/)'],
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/', '<rootDir>/e2e/'],
  testMatch: ['**/src/**/__tests__/**/*.test.[jt]s?(x)', '**/__tests__/**/*.test.[jt]s?(x)'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/__tests__/**',
    // 배럴 파일 제외 (단순 re-export)
    '!**/index.ts',
    // RSC 페이지/레이아웃은 E2E로 커버
    '!app/**/*.{js,jsx,ts,tsx}',
    // 설정 파일 제외
    '!src/shared/config/**',
    // 외부 서비스 래퍼 제외 (GA 등)
    '!src/app/analytics/**',
  ],
  // 회귀 방지용 baseline. 커버리지 실측치는 95/82/93/96 — 각 지표 4~5%pt 버퍼.
  // 실측이 다시 오르면 threshold도 함께 올려 회귀선을 좁혀가는 정책.
  coverageThreshold: {
    global: {
      branches: 78,
      functions: 88,
      lines: 92,
      statements: 91,
    },
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(customJestConfig);

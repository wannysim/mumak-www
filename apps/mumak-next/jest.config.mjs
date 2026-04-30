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
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/', '<rootDir>/e2e/'],
  collectCoverageFrom: [
    'components/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/__tests__/**',
    // RSC 페이지/레이아웃은 E2E로 커버
    '!app/**/*.{js,jsx,ts,tsx}',
    // Provider/래퍼 컴포넌트 제외
    '!components/providers.tsx',
  ],
  // 현재 100%를 baseline으로 고정. 신규 컴포넌트 추가 시 함께 테스트 작성 강제.
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(customJestConfig);

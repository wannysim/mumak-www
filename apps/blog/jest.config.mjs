import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
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
  // 회귀 방지용 baseline. 현재 수치(77/65/73/79)에서 약간의 여유를 둔 값.
  // branches는 보강 여지가 남아있어 다른 항목보다 보수적으로 설정.
  // 추후 보강 후 70%로 동기화 권장.
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(customJestConfig);

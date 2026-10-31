import nextJest from 'next/jest.js';
const createConfig = nextJest({ dir: './' });
export default createConfig({
  watchman: false,
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/', '<rootDir>/e2e/'],
  collectCoverageFrom: ['lib/auth.ts', 'lib/progress.ts'],
  coverageReporters: ['json', 'lcov', 'text', 'json-summary'],
  coverageThreshold: { global: { branches: 80, functions: 90, lines: 90, statements: 90 } },
});

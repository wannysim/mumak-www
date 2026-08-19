import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });
const reporters = process.env.GITHUB_ACTIONS === 'true' ? ['default', 'github-actions'] : ['default'];

export default createJestConfig({
  reporters,
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@mumak/ui/(.*)$': '<rootDir>/../../packages/ui/src/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/', '<rootDir>/e2e/'],
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'src/entities/image/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
});

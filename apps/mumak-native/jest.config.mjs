// Expo SDK 58의 jest-expo와 앱의 Jest 런타임을 30으로 맞춘다.
export default {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/', '/dist/'],
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'constants/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/__tests__/**',
  ],
  // 현재 앱 전체 실측 100%지만 화면/네이티브 모듈 증가 여유를 두고 baseline을 보수적으로 유지한다.
  coverageThreshold: {
    global: { statements: 90, branches: 70, functions: 90, lines: 90 },
  },
};

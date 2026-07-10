// jest-expo는 자체 트리에 jest 29 런타임(@jest/globals 등)을 ^29.2.1로 핀한다. 앱도 jest 29로
// 맞춰 두 런타임 충돌(과거 winter polyfill "import outside scope" 증상)을 근본 차단한다. SDK 56까지
// 동일하므로 jest-expo가 jest 30을 지원하기 전까지 jest 29를 유지한다. 배경은 AGENTS.md → 테스트.
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

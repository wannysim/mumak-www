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
  // placeholder 템플릿 단계의 측정 floor로 잠근 baseline(회귀 방지). 측정이 오르면 함께 상향.
  coverageThreshold: {
    global: { statements: 35, branches: 40, functions: 25, lines: 35 },
  },
};

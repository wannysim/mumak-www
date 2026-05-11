// jest-expo SDK 54 + jest 30 + pnpm has a known incompatibility: Expo's winter polyfill
// lazy-defines globals (TextDecoder/URL/structuredClone/__ExpoImportMetaRegistry…) whose
// getters fire during jest's setup phase, when isInsideTestCode === false, causing
// `Runtime._execModule` to throw "import outside the scope". Real component tests will
// need either jest 29 pin or a fuller polyfill in setupFiles. Until then, test:ci runs
// with --passWithNoTests so CI stays green. See apps/mumak-native/AGENTS.md → 테스트.
export default {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'constants/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/__tests__/**',
  ],
};

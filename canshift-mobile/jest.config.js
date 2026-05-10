// jest.config.js — Unit test runner config for canshift-mobile
// Uses jest-expo preset (Expo SDK 52). Tests run in node environment for
// pure-logic targets (validators, stores). Co-located *.test.ts files are
// picked up next to source; future __tests__/ migration is also supported.

module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/src/**/*.test.tsx',
    '<rootDir>/__tests__/**/*.test.ts',
    '<rootDir>/__tests__/**/*.test.tsx',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^.+\\.css$': '<rootDir>/__mocks__/styleMock.js',
    // canshift-core publishes ESM-only "exports" (import/types only) and the
    // dist files use ESM syntax that jest's CJS resolver can't load directly.
    // Map to the design-tokens module directly — that's the only symbol the
    // theme module reads at test time, and it sidesteps the validation/
    // migration barrel chain (which pulls in @babel/runtime helpers that
    // jest can't locate from outside mobile's node_modules tree).
    '^@tmbk/canshift-core$': '<rootDir>/../canshift-core/src/design-tokens.ts',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|nativewind|react-native-css-interop)',
    '/node_modules/react-native-reanimated/plugin/',
  ],
  // Coverage opt-in: off by default, enabled via `npm run test:coverage`
  // (or any `--coverage` CLI flag). Thresholds gate regressions on the
  // current breadth of the suite; bump them up as coverage grows.
  collectCoverage: false,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/**/*.d.ts',
    '!src/**/index.{ts,tsx}',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'html', 'lcov'],
  coverageThreshold: {
    global: {
      statements: 25,
      branches: 17,
      functions: 24,
      lines: 26,
    },
  },
}

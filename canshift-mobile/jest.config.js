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
    '^.+\\.css$': '<rootDir>/__mocks__/styleMock.ts',
    // canshift-core publishes ESM-only "exports" (import/types only) and the
    // dist files use ESM syntax that jest's CJS resolver can't load directly.
    // Map to a small re-export shim that hand-picks the symbols mobile unit
    // tests need (design tokens + sensor default ramps). The shim sidesteps
    // the validation/migration barrel chain (which pulls in @babel/runtime
    // helpers that jest can't locate from outside mobile's node_modules
    // tree).
    '^@tmbk/canshift-core$': '<rootDir>/__mocks__/canshift-core-shim.ts',
    // Core source files reached through the shim get transpiled by babel-jest,
    // which injects @babel/runtime helper requires. Those resolve relative to
    // the core package (installed --omit=dev, no babel there) — pin them to
    // mobile's own copy.
    '^@babel/runtime/(.*)$': '<rootDir>/node_modules/@babel/runtime/$1',
    // canshift-core source uses ESM-strict `.js` suffixes on relative imports
    // (Node's ESM resolver requires them; the `fix-esm-extensions.mjs` build
    // step adds them automatically to dist). When the mobile shim resolves
    // these TS source files through jest's CJS resolver the `.js` suffix
    // points at non-existent files — strip it so `./colors/hex.js` resolves
    // to `colors/hex.ts`.
    '^(\\.{1,2}/.*)\\.js$': '$1',
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

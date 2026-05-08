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
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
}

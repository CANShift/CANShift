// expo-version.test.ts — Unit tests for readAppVersion helper (#1167)
//
// We re-require the SUT inside `jest.isolateModules` for every case so each
// test gets a freshly-loaded module graph with its own `expo-constants` mock.
// The previous "mutate a shared Constants object" approach was sensitive to
// test-file order: if any other suite (e.g. AboutScreen.test.tsx) loaded the
// real `expo-constants` first, the mock factory could fail to take effect
// and `Constants.expoConfig` ended up as the real module's read-only shape.

function readWith(constantsShape: Record<string, unknown>): string | null {
  let value: string | null = null
  jest.isolateModules(() => {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: constantsShape,
    }))
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.isolateModules requires a synchronous re-require; dynamic `import()` returns a Promise and doesn't share the isolated registry.
    const { readAppVersion } = require('./expo-version') as typeof import('./expo-version')
    value = readAppVersion()
  })
  return value
}

describe('readAppVersion', () => {
  it('returns expoConfig.version when present (modern SDK)', () => {
    expect(readWith({ expoConfig: { version: '2.3.1' } })).toBe('2.3.1')
  })

  it('falls back to nativeAppVersion for legacy manifest shape', () => {
    expect(readWith({ expoConfig: null, nativeAppVersion: '1.5.0' })).toBe('1.5.0')
  })

  it('falls back to version field when nativeAppVersion is absent', () => {
    expect(readWith({ expoConfig: undefined, version: '1.0.0-beta' })).toBe('1.0.0-beta')
  })

  it('returns null when no recognisable version field exists', () => {
    expect(readWith({ expoConfig: null })).toBeNull()
  })
})

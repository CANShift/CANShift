const readWith = (constantsShape: Record<string, unknown>): string | null => {
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

// expo-version.test.ts — Unit tests for readAppVersion helper (#1167)

jest.mock('expo-constants', () => ({ default: {} }), { virtual: true })

import Constants from 'expo-constants'
import { readAppVersion } from './expo-version'

// Helper to override the Constants module shape for each test.
function setConstants(shape: Record<string, unknown>): void {
  Object.keys(Constants).forEach((k) => {
    Reflect.deleteProperty(Constants, k)
  })
  Object.assign(Constants, shape)
}

describe('readAppVersion', () => {
  it('returns expoConfig.version when present (modern SDK)', () => {
    setConstants({ expoConfig: { version: '2.3.1' } })
    expect(readAppVersion()).toBe('2.3.1')
  })

  it('falls back to nativeAppVersion for legacy manifest shape', () => {
    setConstants({ expoConfig: null, nativeAppVersion: '1.5.0' })
    expect(readAppVersion()).toBe('1.5.0')
  })

  it('falls back to version field when nativeAppVersion is absent', () => {
    setConstants({ expoConfig: undefined, version: '1.0.0-beta' })
    expect(readAppVersion()).toBe('1.0.0-beta')
  })

  it('returns null when no recognisable version field exists', () => {
    setConstants({ expoConfig: null })
    expect(readAppVersion()).toBeNull()
  })
})

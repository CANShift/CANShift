// ota-secret.test.ts — OTA HMAC secret loader (build-time + runtime)
//
// Mocks `expo-constants` to drive both code paths: configured-secret and
// dev-fallback. Asserts that the loader never returns an empty buffer and
// never throws on missing config.

import { Buffer } from 'buffer'

// ---------------------------------------------------------------------------
// expo-constants mock — must be registered before importing the SUT
// ---------------------------------------------------------------------------

interface MockExtra {
  otaHmacSecret?: string
}

let mockExtra: MockExtra = {}

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    get expoConfig() {
      return { extra: mockExtra }
    },
  },
}))

// ---------------------------------------------------------------------------
// SUT
// ---------------------------------------------------------------------------

import { DEV_INSECURE_OTA_SECRET, getOtaHmacSecretBytes, isUsingDevOtaSecret } from './ota-secret'

function decodeUtf8(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('utf8')
}

describe('getOtaHmacSecretBytes', () => {
  beforeEach(() => {
    mockExtra = {}
  })

  it('returns the dev fallback when no secret is configured', () => {
    const bytes = getOtaHmacSecretBytes()
    expect(decodeUtf8(bytes)).toBe(DEV_INSECURE_OTA_SECRET)
  })

  it('returns the configured secret when extra.otaHmacSecret is set', () => {
    mockExtra = { otaHmacSecret: 'production-secret-32-bytes-long-x' }
    const bytes = getOtaHmacSecretBytes()
    expect(decodeUtf8(bytes)).toBe('production-secret-32-bytes-long-x')
  })

  it('falls back when extra.otaHmacSecret is empty', () => {
    mockExtra = { otaHmacSecret: '' }
    expect(decodeUtf8(getOtaHmacSecretBytes())).toBe(DEV_INSECURE_OTA_SECRET)
  })

  it('returns a non-empty Uint8Array in every case', () => {
    expect(getOtaHmacSecretBytes().length).toBeGreaterThan(0)
    mockExtra = { otaHmacSecret: 'short' }
    expect(getOtaHmacSecretBytes().length).toBe(5)
  })
})

describe('isUsingDevOtaSecret', () => {
  beforeEach(() => {
    mockExtra = {}
  })

  it('reports true when no secret is configured', () => {
    expect(isUsingDevOtaSecret()).toBe(true)
  })

  it('reports false when a custom secret is configured', () => {
    mockExtra = { otaHmacSecret: 'something-else' }
    expect(isUsingDevOtaSecret()).toBe(false)
  })
})

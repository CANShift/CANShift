import { Buffer } from 'buffer'

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

import { DEV_INSECURE_OTA_SECRET, getOtaHmacSecretBytes } from './ota-secret'

const decodeUtf8 = (bytes: Uint8Array): string => {
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

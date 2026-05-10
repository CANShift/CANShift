// ota-hmac.service.test.ts — Coverage for the OTA HMAC trailer producer (#519).
//
// Test vectors were generated with the same Node `crypto` HMAC-SHA256 code path
// the firmware mbedTLS verifier consumes; if the wire contract drifts, these
// hashes change and CI fails before bad firmware ships.
//
// @vitest-environment node

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  appendOtaHmacTrailer,
  computeOtaHmacTrailer,
  loadOtaHmacSecret,
  OTA_HMAC_DEV_FALLBACK,
  OTA_HMAC_TRAILER_BYTES,
} from './ota-hmac.service'

const FIXED_INPUT = new TextEncoder().encode('CANShift firmware test vector v1')

// HMAC-SHA256(FIXED_INPUT, OTA_HMAC_DEV_FALLBACK) — verify with:
//   echo -n 'CANShift firmware test vector v1' | openssl dgst -sha256 \
//     -hmac 'DEV_INSECURE_REPLACE_BEFORE_PROD'
const FIXED_INPUT_DEV_FALLBACK_MAC_HEX =
  'adb7f18f579fc17f861206e0591ccf3e85e13549211963c5d14068ed05af8cac'

const FIXED_INPUT_TEST_SECRET_MAC_HEX =
  '1c34ff28cf8efd013b05fc2bcb5eb94771597980733523199ae3a61b665951bc'

const EMPTY_INPUT_DEV_FALLBACK_MAC_HEX =
  '08c22ac7ac0204fb2638d6a6ff0e54506b73332f0e3a22d85718fb1017bf22b8'

const EXACT_32_INPUT_DEV_FALLBACK_MAC_HEX =
  'aea1d856ca3907c586b21047579cac96defed5d0f93e1e60a16d776a2c11ed00'

const TWO_MB_INPUT_DEV_FALLBACK_MAC_HEX =
  'f4da4a18a70162bfabf5dd86f1e92119515507d30a27f70aa9456236e7622da5'

function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex')
}

describe('computeOtaHmacTrailer — wire-contract MAC producer', () => {
  it('returns exactly 32 bytes', () => {
    const mac = computeOtaHmacTrailer(FIXED_INPUT, OTA_HMAC_DEV_FALLBACK)
    expect(mac.length).toBe(OTA_HMAC_TRAILER_BYTES)
  })

  it('matches the dev-fallback fixed vector', () => {
    const mac = computeOtaHmacTrailer(FIXED_INPUT, OTA_HMAC_DEV_FALLBACK)
    expect(toHex(mac)).toBe(FIXED_INPUT_DEV_FALLBACK_MAC_HEX)
  })

  it('changes when the secret changes', () => {
    const mac = computeOtaHmacTrailer(FIXED_INPUT, 'test-secret')
    expect(toHex(mac)).toBe(FIXED_INPUT_TEST_SECRET_MAC_HEX)
  })

  it('handles empty firmware (well-defined HMAC)', () => {
    const mac = computeOtaHmacTrailer(new Uint8Array(0), OTA_HMAC_DEV_FALLBACK)
    expect(toHex(mac)).toBe(EMPTY_INPUT_DEV_FALLBACK_MAC_HEX)
  })

  it('handles firmware that is exactly 32 bytes (boundary case)', () => {
    const input = new Uint8Array(OTA_HMAC_TRAILER_BYTES).fill(0xab)
    const mac = computeOtaHmacTrailer(input, OTA_HMAC_DEV_FALLBACK)
    expect(toHex(mac)).toBe(EXACT_32_INPUT_DEV_FALLBACK_MAC_HEX)
  })

  it('handles multi-MB firmware without truncation', () => {
    const twoMb = new Uint8Array(2 * 1024 * 1024).fill(0x41)
    const mac = computeOtaHmacTrailer(twoMb, OTA_HMAC_DEV_FALLBACK)
    expect(toHex(mac)).toBe(TWO_MB_INPUT_DEV_FALLBACK_MAC_HEX)
  })

  it('rejects an empty secret', () => {
    expect(() => computeOtaHmacTrailer(FIXED_INPUT, '')).toThrow(/non-empty/)
  })
})

describe('appendOtaHmacTrailer — produces firmware || trailer', () => {
  it('grows the buffer by exactly 32 bytes', () => {
    const out = appendOtaHmacTrailer(FIXED_INPUT, OTA_HMAC_DEV_FALLBACK)
    expect(out.length).toBe(FIXED_INPUT.length + OTA_HMAC_TRAILER_BYTES)
  })

  it('keeps the original firmware bytes untouched at the head', () => {
    const out = appendOtaHmacTrailer(FIXED_INPUT, OTA_HMAC_DEV_FALLBACK)
    expect(out.slice(0, FIXED_INPUT.length)).toEqual(FIXED_INPUT)
  })

  it('places the matching MAC in the final 32 bytes', () => {
    const out = appendOtaHmacTrailer(FIXED_INPUT, OTA_HMAC_DEV_FALLBACK)
    const trailer = out.slice(out.length - OTA_HMAC_TRAILER_BYTES)
    expect(toHex(trailer)).toBe(FIXED_INPUT_DEV_FALLBACK_MAC_HEX)
  })

  it('handles empty firmware → output is just the 32-byte MAC', () => {
    const out = appendOtaHmacTrailer(new Uint8Array(0), OTA_HMAC_DEV_FALLBACK)
    expect(out.length).toBe(OTA_HMAC_TRAILER_BYTES)
    expect(toHex(out)).toBe(EMPTY_INPUT_DEV_FALLBACK_MAC_HEX)
  })
})

describe('loadOtaHmacSecret — env > secrets.json > dev fallback', () => {
  let tempRoot: string
  const originalEnv = process.env.OTA_HMAC_SECRET

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), 'canshift-ota-hmac-'))
    delete process.env.OTA_HMAC_SECRET
  })

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true })
    if (originalEnv === undefined) {
      delete process.env.OTA_HMAC_SECRET
    } else {
      process.env.OTA_HMAC_SECRET = originalEnv
    }
    vi.restoreAllMocks()
  })

  it('returns the env var when set', () => {
    process.env.OTA_HMAC_SECRET = 'from-env-1234'
    expect(loadOtaHmacSecret(tempRoot)).toBe('from-env-1234')
  })

  it('falls back to secrets.json when env is unset', () => {
    writeFileSync(
      join(tempRoot, 'secrets.json'),
      JSON.stringify({ otaHmacSecret: 'from-file-5678' }),
      'utf8'
    )
    expect(loadOtaHmacSecret(tempRoot)).toBe('from-file-5678')
  })

  it('prefers env over secrets.json', () => {
    process.env.OTA_HMAC_SECRET = 'env-wins'
    writeFileSync(
      join(tempRoot, 'secrets.json'),
      JSON.stringify({ otaHmacSecret: 'file-loses' }),
      'utf8'
    )
    expect(loadOtaHmacSecret(tempRoot)).toBe('env-wins')
  })

  it('returns dev fallback when neither env nor file is present', () => {
    expect(loadOtaHmacSecret(tempRoot)).toBe(OTA_HMAC_DEV_FALLBACK)
  })

  it('returns dev fallback when secrets.json is missing the key', () => {
    writeFileSync(join(tempRoot, 'secrets.json'), JSON.stringify({ unrelated: 'x' }), 'utf8')
    expect(loadOtaHmacSecret(tempRoot)).toBe(OTA_HMAC_DEV_FALLBACK)
  })

  it('throws on invalid JSON in secrets.json', () => {
    writeFileSync(join(tempRoot, 'secrets.json'), '{ not-json', 'utf8')
    expect(() => loadOtaHmacSecret(tempRoot)).toThrow(/Invalid JSON/)
  })

  it('treats empty env var as unset and falls back to file/default', () => {
    process.env.OTA_HMAC_SECRET = ''
    expect(loadOtaHmacSecret(tempRoot)).toBe(OTA_HMAC_DEV_FALLBACK)
  })

  it('does not log the secret on any code path', () => {
    process.env.OTA_HMAC_SECRET = 'super-secret-must-not-appear'
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    loadOtaHmacSecret(tempRoot)
    for (const spy of [logSpy, errSpy, warnSpy]) {
      for (const call of spy.mock.calls) {
        for (const arg of call) {
          expect(String(arg)).not.toContain('super-secret-must-not-appear')
        }
      }
    }
  })
})

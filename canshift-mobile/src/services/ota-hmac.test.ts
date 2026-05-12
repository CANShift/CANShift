// ota-hmac.test.ts — HMAC-SHA256 conformance + trailer producer
//
// We trust this implementation only insofar as it matches the canonical
// vectors from RFC 4231 (HMAC-SHA-256). Additional CANShift-specific
// vectors lock in cross-platform agreement with the firmware verifier
// (which uses mbedTLS) and the studio counterpart (#519).
//
// All "expected" digests in this file were independently produced via
// Node's `crypto.createHmac('sha256', key).update(msg).digest('hex')`.

import { Buffer } from 'buffer'
import { appendHmacTrailer, hmacSha256, HMAC_SHA256_LEN } from './ota-hmac'
import { bytesToHex } from './sha256'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hex(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, 'hex'))
}

function utf8(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, 'utf8'))
}

function filled(len: number, byte: number): Uint8Array {
  return new Uint8Array(len).fill(byte)
}

const DEV_SECRET_BYTES = utf8('DEV_INSECURE_REPLACE_BEFORE_PROD')

// ---------------------------------------------------------------------------
// RFC 4231 — HMAC-SHA-256 test vectors
// ---------------------------------------------------------------------------

describe('hmacSha256 — RFC 4231 vectors', () => {
  it('test case 1 (20-byte 0x0b key, "Hi There")', () => {
    expect(bytesToHex(hmacSha256(hex('0b'.repeat(20)), utf8('Hi There')))).toBe(
      'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7'
    )
  })

  it('test case 2 (key shorter than block size)', () => {
    expect(bytesToHex(hmacSha256(utf8('Jefe'), utf8('what do ya want for nothing?')))).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843'
    )
  })

  it('test case 4 (50-byte 0xcd message)', () => {
    expect(
      bytesToHex(
        hmacSha256(hex('0102030405060708090a0b0c0d0e0f10111213141516171819'), filled(50, 0xcd))
      )
    ).toBe('82558a389a443c0ea4cc819899f2083a85f0faa3e578f8077a2e3ff46729665b')
  })

  it('test case 6 (131-byte key — exercises the "key longer than block" path)', () => {
    expect(
      bytesToHex(
        hmacSha256(
          filled(131, 0xaa),
          utf8('Test Using Larger Than Block-Size Key - Hash Key First')
        )
      )
    ).toBe('60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54')
  })
})

// ---------------------------------------------------------------------------
// CANShift dev-secret cross-platform vectors
// ---------------------------------------------------------------------------

describe('hmacSha256 — CANShift dev secret', () => {
  it('hashes the empty message', () => {
    expect(bytesToHex(hmacSha256(DEV_SECRET_BYTES, new Uint8Array(0)))).toBe(
      '08c22ac7ac0204fb2638d6a6ff0e54506b73332f0e3a22d85718fb1017bf22b8'
    )
  })

  it('hashes "abc"', () => {
    expect(bytesToHex(hmacSha256(DEV_SECRET_BYTES, utf8('abc')))).toBe(
      'a79ed21010711377578272c3645f7aef07f8f898709d8803a5db317f02d74266'
    )
  })

  it('hashes a 32-byte 0xab buffer (sub-block size)', () => {
    expect(bytesToHex(hmacSha256(DEV_SECRET_BYTES, filled(32, 0xab)))).toBe(
      'aea1d856ca3907c586b21047579cac96defed5d0f93e1e60a16d776a2c11ed00'
    )
  })

  it('hashes a 64-byte 0xcd buffer (exact one block)', () => {
    expect(bytesToHex(hmacSha256(DEV_SECRET_BYTES, filled(64, 0xcd)))).toBe(
      'a34dc609f7724760c403531b760564d5605a398b90603cee3d27adcaf30dcd6f'
    )
  })

  it('hashes a 1 MB synthetic buffer (multi-block streaming)', () => {
    const big = new Uint8Array(1024 * 1024)
    for (let i = 0; i < big.length; i++) big[i] = i & 0xff
    expect(bytesToHex(hmacSha256(DEV_SECRET_BYTES, big))).toBe(
      '9eb9c5050adac6dad1732994bbe1d7f2828772d40a48fe961d269e85c13e86e9'
    )
  })
})

// ---------------------------------------------------------------------------
// Trailer producer
// ---------------------------------------------------------------------------

describe('appendHmacTrailer', () => {
  it('appends exactly 32 bytes', () => {
    const data = utf8('hello')
    const out = appendHmacTrailer(data, DEV_SECRET_BYTES)
    expect(out.length).toBe(data.length + HMAC_SHA256_LEN)
  })

  it('preserves the original payload byte-for-byte', () => {
    const data = utf8('canshift-payload')
    const out = appendHmacTrailer(data, DEV_SECRET_BYTES)
    expect(out.subarray(0, data.length)).toEqual(data)
  })

  it('trailer matches a fresh hmacSha256 of the payload', () => {
    const data = utf8('canshift-payload')
    const out = appendHmacTrailer(data, DEV_SECRET_BYTES)
    const trailer = out.subarray(out.length - HMAC_SHA256_LEN)
    const expected = hmacSha256(DEV_SECRET_BYTES, data)
    expect(bytesToHex(trailer)).toBe(bytesToHex(expected))
  })

  it('handles an empty buffer (trailer-only output)', () => {
    const out = appendHmacTrailer(new Uint8Array(0), DEV_SECRET_BYTES)
    expect(out.length).toBe(HMAC_SHA256_LEN)
    expect(bytesToHex(out)).toBe('08c22ac7ac0204fb2638d6a6ff0e54506b73332f0e3a22d85718fb1017bf22b8')
  })

  it('handles an exact-32-byte buffer', () => {
    const data = filled(32, 0xab)
    const out = appendHmacTrailer(data, DEV_SECRET_BYTES)
    expect(out.length).toBe(64)
    expect(out.subarray(0, 32)).toEqual(data)
    expect(bytesToHex(out.subarray(32))).toBe(
      'aea1d856ca3907c586b21047579cac96defed5d0f93e1e60a16d776a2c11ed00'
    )
  })

  it('handles a multi-MB synthetic buffer', () => {
    const data = new Uint8Array(1024 * 1024)
    for (let i = 0; i < data.length; i++) data[i] = i & 0xff
    const out = appendHmacTrailer(data, DEV_SECRET_BYTES)
    expect(out.length).toBe(data.length + HMAC_SHA256_LEN)
    expect(bytesToHex(out.subarray(out.length - HMAC_SHA256_LEN))).toBe(
      '9eb9c5050adac6dad1732994bbe1d7f2828772d40a48fe961d269e85c13e86e9'
    )
  })
})

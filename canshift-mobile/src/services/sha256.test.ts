// sha256.test.ts — SHA-256 conformance against NIST test vectors
//
// We trust this implementation only insofar as it matches the canonical
// vectors from FIPS 180-4 and a few extra cases that exercise the multi-block
// path we'll hit on real firmware binaries.

import { Buffer } from 'buffer'
import { Sha256, sha256Hex, bytesToHex } from './sha256'

function utf8(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, 'utf8'))
}

describe('sha256Hex', () => {
  // FIPS 180-4 published test vectors
  it('hashes the empty string', () => {
    expect(sha256Hex(new Uint8Array(0))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })

  it("hashes 'abc'", () => {
    expect(sha256Hex(utf8('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('hashes the 448-bit message (multi-block boundary)', () => {
    expect(
      sha256Hex(utf8('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')),
    ).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    )
  })

  it("hashes one million 'a' characters", () => {
    const data = new Uint8Array(1_000_000).fill(0x61)
    expect(sha256Hex(data)).toBe(
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
    )
  })

  it('handles a single byte', () => {
    expect(sha256Hex(new Uint8Array([0x00]))).toBe(
      '6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d',
    )
  })

  it('handles a 63-byte message (one byte short of a block)', () => {
    const data = new Uint8Array(63).fill(0xab)
    // Independently produced via Node's crypto.createHash('sha256').
    expect(sha256Hex(data)).toBe(
      'd1036ba30d050c74b1a5ab301fa29ff0c607a27cc55af3412577f7e06dbd190b',
    )
  })

  it('handles a 64-byte message (exactly one block)', () => {
    const data = new Uint8Array(64).fill(0xab)
    expect(sha256Hex(data)).toBe(
      'ec65c8798ecf95902413c40f7b9e6d4b0068885f5f324aba1f9ba1c8e14aea61',
    )
  })

  it('handles a 65-byte message (one byte into a second block)', () => {
    const data = new Uint8Array(65).fill(0xab)
    expect(sha256Hex(data)).toBe(
      '39cd843414d5125dd308568ace26d04e60b7fa6d2b1a901fb5184fa2eae0598b',
    )
  })
})

describe('Sha256 streaming', () => {
  it('produces the same digest whether fed in one go or in chunks', () => {
    const message = utf8('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')

    const oneShot = sha256Hex(message)

    const chunked = new Sha256()
    chunked.update(message.subarray(0, 1))
    chunked.update(message.subarray(1, 33))
    chunked.update(message.subarray(33))
    expect(chunked.digestHex()).toBe(oneShot)
  })

  it('handles many small chunks across a block boundary', () => {
    const data = new Uint8Array(1000)
    for (let i = 0; i < data.length; i++) data[i] = i & 0xff

    const oneShot = sha256Hex(data)

    const streamed = new Sha256()
    for (let i = 0; i < data.length; i += 7) {
      streamed.update(data.subarray(i, Math.min(i + 7, data.length)))
    }
    expect(streamed.digestHex()).toBe(oneShot)
  })

  it('rejects update after digest', () => {
    const h = new Sha256()
    h.update(utf8('abc'))
    h.digest()
    expect(() => h.update(utf8('def'))).toThrow(/after digest/i)
  })

  it('rejects digest twice', () => {
    const h = new Sha256()
    h.update(utf8('abc'))
    h.digest()
    expect(() => h.digest()).toThrow(/twice/i)
  })
})

describe('bytesToHex', () => {
  it('lowercase-hex encodes a byte array', () => {
    expect(bytesToHex(new Uint8Array([0x00, 0x0f, 0xff, 0xab, 0xcd]))).toBe(
      '000fffabcd',
    )
  })

  it('encodes the empty array', () => {
    expect(bytesToHex(new Uint8Array(0))).toBe('')
  })
})

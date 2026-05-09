// sha256.ts — Pure-JS SHA-256 for OTA checksum verification
//
// We can't add `expo-crypto` without a native dep; React Native's JSC/Hermes
// runtime has no `crypto.subtle`. This module implements the FIPS 180-4
// SHA-256 algorithm in pure JS over `Uint8Array`. It runs once per OTA flash
// (~1.4 MB), so absolute throughput is uncritical — clarity first.
//
// Behaviour is locked in by `sha256.test.ts` against the standard NIST test
// vectors and a few CANShift-specific cases. Do not optimise the inner loops
// without re-running those tests.

// ---------------------------------------------------------------------------
// Constants — first 32 bits of the fractional parts of the cube roots of the
// first 64 primes (FIPS 180-4 §4.2.2).
// ---------------------------------------------------------------------------

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

/** Initial hash values — first 32 bits of fractional parts of square roots of
 *  the first 8 primes (FIPS 180-4 §5.3.3). */
const H0 = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
  0x1f83d9ab, 0x5be0cd19,
])

// ---------------------------------------------------------------------------
// Bit operations — Uint32 wrap-around via `>>> 0`
// ---------------------------------------------------------------------------

function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0
}

// ---------------------------------------------------------------------------
// Streaming hasher
// ---------------------------------------------------------------------------

/**
 * Incremental SHA-256 hasher. Allocate one, feed `Uint8Array` chunks via
 * `update()`, then call `digest()` (or `digestHex()`) to finalize.
 *
 * Calling `update()` after `digest()` throws — create a new hasher per file.
 */
export class Sha256 {
  private readonly h: Uint32Array
  private readonly buffer: Uint8Array
  private bufferLen: number
  private totalLen: number
  private finalized: boolean

  constructor() {
    this.h = new Uint32Array(H0)
    this.buffer = new Uint8Array(64)
    this.bufferLen = 0
    this.totalLen = 0
    this.finalized = false
  }

  update(data: Uint8Array): this {
    if (this.finalized) {
      throw new Error('Sha256.update called after digest')
    }
    let i = 0
    const n = data.length
    this.totalLen += n

    // Drain into pending buffer first if it has content
    if (this.bufferLen > 0) {
      const space = 64 - this.bufferLen
      const take = Math.min(space, n)
      this.buffer.set(data.subarray(0, take), this.bufferLen)
      this.bufferLen += take
      i += take
      if (this.bufferLen === 64) {
        this.compress(this.buffer, 0)
        this.bufferLen = 0
      }
    }

    // Compress full 64-byte chunks directly from `data`
    while (n - i >= 64) {
      this.compress(data, i)
      i += 64
    }

    // Stash the remainder
    if (i < n) {
      this.buffer.set(data.subarray(i, n), 0)
      this.bufferLen = n - i
    }
    return this
  }

  digest(): Uint8Array {
    if (this.finalized) {
      throw new Error('Sha256.digest called twice')
    }
    this.finalized = true

    // Pad: append 0x80, then zeros up to mod 64 == 56, then 8-byte big-endian
    // length-in-bits. If there isn't enough room, pad twice.
    const bitLenHigh = Math.floor(this.totalLen / 0x20000000) | 0 // (totalLen * 8) >> 32 in 53-bit-safe form
    const bitLenLow = (this.totalLen << 3) >>> 0

    this.buffer[this.bufferLen++] = 0x80
    if (this.bufferLen > 56) {
      // No room for the length — pad this block, compress, start a new one
      while (this.bufferLen < 64) this.buffer[this.bufferLen++] = 0
      this.compress(this.buffer, 0)
      this.bufferLen = 0
    }
    while (this.bufferLen < 56) this.buffer[this.bufferLen++] = 0

    // 64-bit big-endian bit length
    this.buffer[56] = (bitLenHigh >>> 24) & 0xff
    this.buffer[57] = (bitLenHigh >>> 16) & 0xff
    this.buffer[58] = (bitLenHigh >>> 8) & 0xff
    this.buffer[59] = bitLenHigh & 0xff
    this.buffer[60] = (bitLenLow >>> 24) & 0xff
    this.buffer[61] = (bitLenLow >>> 16) & 0xff
    this.buffer[62] = (bitLenLow >>> 8) & 0xff
    this.buffer[63] = bitLenLow & 0xff
    this.compress(this.buffer, 0)

    // Serialise H as big-endian bytes
    const out = new Uint8Array(32)
    for (let i = 0; i < 8; i++) {
      const v = this.h[i] ?? 0
      out[i * 4] = (v >>> 24) & 0xff
      out[i * 4 + 1] = (v >>> 16) & 0xff
      out[i * 4 + 2] = (v >>> 8) & 0xff
      out[i * 4 + 3] = v & 0xff
    }
    return out
  }

  digestHex(): string {
    return bytesToHex(this.digest())
  }

  private compress(block: Uint8Array, offset: number): void {
    // Message schedule W[0..63]
    const w = new Uint32Array(64)
    for (let t = 0; t < 16; t++) {
      const b0 = block[offset + t * 4] ?? 0
      const b1 = block[offset + t * 4 + 1] ?? 0
      const b2 = block[offset + t * 4 + 2] ?? 0
      const b3 = block[offset + t * 4 + 3] ?? 0
      w[t] = ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0
    }
    for (let t = 16; t < 64; t++) {
      const w15 = w[t - 15] ?? 0
      const w2 = w[t - 2] ?? 0
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3)
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10)
      w[t] = (((w[t - 16] ?? 0) + s0 + (w[t - 7] ?? 0) + s1) >>> 0) | 0
    }

    let a = this.h[0] ?? 0
    let b = this.h[1] ?? 0
    let c = this.h[2] ?? 0
    let d = this.h[3] ?? 0
    let e = this.h[4] ?? 0
    let f = this.h[5] ?? 0
    let g = this.h[6] ?? 0
    let h = this.h[7] ?? 0

    for (let t = 0; t < 64; t++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + s1 + ch + (K[t] ?? 0) + (w[t] ?? 0)) >>> 0
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (s0 + maj) >>> 0

      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }

    this.h[0] = ((this.h[0] ?? 0) + a) >>> 0
    this.h[1] = ((this.h[1] ?? 0) + b) >>> 0
    this.h[2] = ((this.h[2] ?? 0) + c) >>> 0
    this.h[3] = ((this.h[3] ?? 0) + d) >>> 0
    this.h[4] = ((this.h[4] ?? 0) + e) >>> 0
    this.h[5] = ((this.h[5] ?? 0) + f) >>> 0
    this.h[6] = ((this.h[6] ?? 0) + g) >>> 0
    this.h[7] = ((this.h[7] ?? 0) + h) >>> 0
  }
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/** One-shot hash of a `Uint8Array`, returns lowercase hex. */
export function sha256Hex(data: Uint8Array): string {
  return new Sha256().update(data).digestHex()
}

/** Lowercase hex encoding of a byte array. */
export function bytesToHex(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) {
    s += (b >>> 4).toString(16) + (b & 0x0f).toString(16)
  }
  return s
}

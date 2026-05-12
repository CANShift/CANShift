// ota-hmac.ts — HMAC-SHA256 producer for OTA upload trailer
//
// Counterpart to the firmware verifier in
// `canshift-firmware/src/hal/wifi/ota_hmac.cpp`. The wire contract is:
//
//     <firmware bytes> || HMAC_SHA256(firmware bytes, secret)
//
// i.e. a 32-byte trailer appended to the binary before the multipart
// upload. The firmware streams the body to flash, peels the trailing
// 32 bytes off, and constant-time-compares them to its own HMAC.
//
// React Native (Hermes) does not expose `crypto.subtle` and we're avoiding
// `react-native-quick-crypto` to keep the JSI surface small. The standard
// HMAC construction (FIPS PUB 198-1) over our existing pure-JS SHA-256 is
// ~30 LOC and conformance is locked in by RFC 4231 vectors in
// `ota-hmac.test.ts`.
//
// Performance note: we hash a ~1.4 MB blob once per OTA flash. The pure-JS
// SHA-256 already does that in <1 s on a modern phone, so HMAC's two
// passes (ipad + opad) stay well under the OTA upload latency.

import { Sha256 } from './sha256'

// ---------------------------------------------------------------------------
// Constants — FIPS PUB 198-1
// ---------------------------------------------------------------------------

/** SHA-256 block size in bytes (B in RFC 2104 / FIPS 198-1). */
const SHA256_BLOCK_SIZE = 64

/** SHA-256 output size — also the HMAC trailer length. */
export const HMAC_SHA256_LEN = 32

/** Inner-pad XOR mask. */
const IPAD_BYTE = 0x36

/** Outer-pad XOR mask. */
const OPAD_BYTE = 0x5c

// ---------------------------------------------------------------------------
// Key derivation (FIPS 198-1 §4)
// ---------------------------------------------------------------------------

/**
 * Normalise a raw key to exactly `SHA256_BLOCK_SIZE` bytes:
 *  - keys longer than the block size are hashed first,
 *  - shorter keys are right-padded with zeros.
 *
 * Returns a fresh buffer the caller can mutate.
 */
function deriveBlockSizedKey(key: Uint8Array): Uint8Array {
  const out = new Uint8Array(SHA256_BLOCK_SIZE)
  if (key.length > SHA256_BLOCK_SIZE) {
    out.set(new Sha256().update(key).digest())
    return out
  }
  out.set(key)
  return out
}

// ---------------------------------------------------------------------------
// HMAC-SHA256
// ---------------------------------------------------------------------------

/**
 * Compute HMAC-SHA256 of `message` using `key`. Both arguments and the
 * return value are raw byte arrays.
 *
 * The key is normalised per FIPS 198-1 (hashed if too long, zero-padded if
 * too short). The function never logs the key or the message.
 */
export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  const k0 = deriveBlockSizedKey(key)

  const ipad = new Uint8Array(SHA256_BLOCK_SIZE)
  const opad = new Uint8Array(SHA256_BLOCK_SIZE)
  for (let i = 0; i < SHA256_BLOCK_SIZE; i++) {
    const b = k0[i] ?? 0
    ipad[i] = b ^ IPAD_BYTE
    opad[i] = b ^ OPAD_BYTE
  }

  const inner = new Sha256().update(ipad).update(message).digest()
  return new Sha256().update(opad).update(inner).digest()
}

// ---------------------------------------------------------------------------
// Trailer producer
// ---------------------------------------------------------------------------

/**
 * Append the HMAC-SHA256 trailer to `data` and return a single buffer of
 * `data.length + 32` bytes. Empty input is allowed and produces a 32-byte
 * trailer-only buffer.
 */
export function appendHmacTrailer(data: Uint8Array, key: Uint8Array): Uint8Array {
  const trailer = hmacSha256(key, data)
  const out = new Uint8Array(data.length + HMAC_SHA256_LEN)
  out.set(data, 0)
  out.set(trailer, data.length)
  return out
}

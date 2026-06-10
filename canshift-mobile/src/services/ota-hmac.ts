import { Sha256 } from './sha256'

const SHA256_BLOCK_SIZE = 64

export const HMAC_SHA256_LEN = 32

const IPAD_BYTE = 0x36

const OPAD_BYTE = 0x5c

const deriveBlockSizedKey = (key: Uint8Array): Uint8Array => {
  const out = new Uint8Array(SHA256_BLOCK_SIZE)
  if (key.length > SHA256_BLOCK_SIZE) {
    out.set(new Sha256().update(key).digest())
    return out
  }
  out.set(key)
  return out
}

export const hmacSha256 = (key: Uint8Array, message: Uint8Array): Uint8Array => {
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

export const appendHmacTrailer = (data: Uint8Array, key: Uint8Array): Uint8Array => {
  const trailer = hmacSha256(key, data)
  const out = new Uint8Array(data.length + HMAC_SHA256_LEN)
  out.set(data, 0)
  out.set(trailer, data.length)
  return out
}

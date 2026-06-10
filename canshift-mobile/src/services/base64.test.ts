import { Buffer } from 'buffer'
import { decodeBase64, encodeBase64 } from './base64'

describe('encodeBase64 / decodeBase64', () => {
  it('round-trips ASCII strings', () => {
    const input = 'hello'
    expect(decodeBase64(encodeBase64(input))).toBe(input)
  })

  it('round-trips multi-byte UTF-8 strings', () => {
    const input = 'héllo — CANShift 🚗'
    expect(decodeBase64(encodeBase64(input))).toBe(input)
  })

  it('round-trips a JSON-shaped payload representative of BLE traffic', () => {
    const input = JSON.stringify({ r: 4500, tps: 25, map: 100, bst: 0.8 })
    expect(decodeBase64(encodeBase64(input))).toBe(input)
  })

  it('round-trips strings containing valid-utf8 binary-ish bytes (NUL, DEL)', () => {
    const input = '\x00\x01\x42\x10\x7f'
    expect(decodeBase64(encodeBase64(input))).toBe(input)
  })

  it('decodes base64 produced from arbitrary bytes, replacing invalid utf8', () => {
    const bytes = new Uint8Array([0x00, 0xff, 0x42, 0x10, 0x7f])
    const base64 = Buffer.from(bytes).toString('base64')
    expect(() => decodeBase64(base64)).not.toThrow()
    expect(typeof decodeBase64(base64)).toBe('string')
  })

  it('round-trips the empty string', () => {
    expect(encodeBase64('')).toBe('')
    expect(decodeBase64('')).toBe('')
    expect(decodeBase64(encodeBase64(''))).toBe('')
  })

  it('does not throw on invalid base64 input — returns best-effort decode', () => {
    expect(() => decodeBase64('!!!not_base64@@@')).not.toThrow()
    expect(typeof decodeBase64('!!!not_base64@@@')).toBe('string')
    expect(decodeBase64('====')).toBe('')
  })
})

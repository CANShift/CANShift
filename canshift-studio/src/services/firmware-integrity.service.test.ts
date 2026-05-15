// firmware-integrity.service.test.ts — Pre-flash SHA-256 verification (#671).
//
// The studio currently flashes any bytes returned by the GitHub release CDN
// without integrity verification. These tests pin the contract of the
// verification helper that closes that gap:
//
//   - Match: the digest of the downloaded buffer equals the manifest → returns
//     the verified hex digest, no throw.
//   - Mismatch: the digest differs → throws FirmwareIntegrityError(kind:'mismatch').
//   - Missing manifest: IPC text fetch rejects → throws
//     FirmwareIntegrityError(kind:'missing'). Critical — silent fallback would
//     defeat the whole check.
//   - Malformed manifest: body is not a valid sha256 line → throws
//     FirmwareIntegrityError(kind:'malformed').
//   - Manifest tolerances: extra whitespace, coreutils `<hex>  <name>` layout,
//     and CRLF line endings are accepted; anything else is rejected.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const downloadTextMock = vi.fn<(url: string) => Promise<string>>()

vi.mock('./ipc.service', () => ({
  firmwareIpc: {
    downloadText: (url: string): Promise<string> => downloadTextMock(url),
  },
}))

import {
  FirmwareIntegrityError,
  computeSha256Hex,
  parseSha256Manifest,
  verifyFirmwareSha256,
} from './firmware-integrity.service'

// Known-good test fixture: SHA-256 of the four bytes 0x01 0x02 0x03 0x04. The
// digest is reproduced here verbatim so a regression in computeSha256Hex (e.g.
// switching to a different algorithm) fails the assertion against a concrete
// expected value instead of a self-fulfilling re-computation.
const FIXTURE_BUFFER: ArrayBuffer = new Uint8Array([0x01, 0x02, 0x03, 0x04]).buffer
const FIXTURE_DIGEST = '9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a'

beforeEach(() => {
  downloadTextMock.mockReset()
})

describe('computeSha256Hex', () => {
  it('produces the canonical 64-char lowercase hex digest', async () => {
    const digest = await computeSha256Hex(FIXTURE_BUFFER)
    expect(digest).toBe(FIXTURE_DIGEST)
    expect(digest).toMatch(/^[0-9a-f]{64}$/)
  })

  it('handles an empty buffer', async () => {
    // SHA-256("") — well-known constant.
    const digest = await computeSha256Hex(new ArrayBuffer(0))
    expect(digest).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })
})

describe('parseSha256Manifest', () => {
  it('accepts a bare hex digest', () => {
    const out = parseSha256Manifest(FIXTURE_DIGEST)
    expect(out).toBe(FIXTURE_DIGEST)
  })

  it('accepts the coreutils "<hex>  <filename>" layout', () => {
    const out = parseSha256Manifest(`${FIXTURE_DIGEST}  canshift-firmware-0.7.1.bin\n`)
    expect(out).toBe(FIXTURE_DIGEST)
  })

  it('lowercases an uppercase digest', () => {
    const out = parseSha256Manifest(FIXTURE_DIGEST.toUpperCase())
    expect(out).toBe(FIXTURE_DIGEST)
  })

  it('tolerates leading whitespace, blank lines, BOM, and CRLF endings', () => {
    const out = parseSha256Manifest(`\ufeff\r\n   \r\n   ${FIXTURE_DIGEST}  firmware.bin\r\n`)
    expect(out).toBe(FIXTURE_DIGEST)
  })

  it('returns null for a short or non-hex string', () => {
    expect(parseSha256Manifest('not-a-hash')).toBeNull()
    expect(parseSha256Manifest('abc123')).toBeNull()
    // 63 chars — one short of a sha256.
    expect(parseSha256Manifest('a'.repeat(63))).toBeNull()
    // 65 chars — one too many.
    expect(parseSha256Manifest('a'.repeat(65))).toBeNull()
  })

  it('returns null for an empty body', () => {
    expect(parseSha256Manifest('')).toBeNull()
    expect(parseSha256Manifest('   \n\n\n')).toBeNull()
  })
})

describe('verifyFirmwareSha256 — happy path', () => {
  it('returns the verified digest when the manifest matches the buffer', async () => {
    downloadTextMock.mockResolvedValueOnce(FIXTURE_DIGEST)

    const digest = await verifyFirmwareSha256(FIXTURE_BUFFER, 'https://x/firmware.bin.sha256')

    expect(digest).toBe(FIXTURE_DIGEST)
    expect(downloadTextMock).toHaveBeenCalledWith('https://x/firmware.bin.sha256')
  })

  it('accepts a coreutils-style manifest body', async () => {
    downloadTextMock.mockResolvedValueOnce(`${FIXTURE_DIGEST}  firmware.bin\n`)

    const digest = await verifyFirmwareSha256(FIXTURE_BUFFER, 'https://x/firmware.bin.sha256')

    expect(digest).toBe(FIXTURE_DIGEST)
  })
})

describe('verifyFirmwareSha256 — mismatch (the core threat)', () => {
  it('throws FirmwareIntegrityError(kind:"mismatch") when the manifest disagrees', async () => {
    const wrongDigest = '0'.repeat(64)
    downloadTextMock.mockResolvedValueOnce(wrongDigest)

    await expect(
      verifyFirmwareSha256(FIXTURE_BUFFER, 'https://x/firmware.bin.sha256')
    ).rejects.toMatchObject({
      name: 'FirmwareIntegrityError',
      kind: 'mismatch',
      expected: wrongDigest,
      actual: FIXTURE_DIGEST,
    })
  })

  it('mismatch error message names both digests so the user sees the evidence', async () => {
    downloadTextMock.mockResolvedValueOnce('1'.repeat(64))

    let caught: unknown
    try {
      await verifyFirmwareSha256(FIXTURE_BUFFER, 'https://x/firmware.bin.sha256')
    } catch (err: unknown) {
      caught = err
    }
    expect(caught).toBeInstanceOf(FirmwareIntegrityError)
    const err = caught as FirmwareIntegrityError
    expect(err.message).toContain('SHA-256 mismatch')
    expect(err.message).toContain(FIXTURE_DIGEST)
    expect(err.message).toContain('1'.repeat(64))
    expect(err.message).toContain('refusing to flash')
  })
})

describe('verifyFirmwareSha256 — missing manifest (no silent fallback)', () => {
  it('throws FirmwareIntegrityError(kind:"missing") when the IPC text fetch rejects', async () => {
    downloadTextMock.mockRejectedValueOnce(new Error('HTTP 404'))

    await expect(
      verifyFirmwareSha256(FIXTURE_BUFFER, 'https://x/firmware.bin.sha256')
    ).rejects.toMatchObject({
      name: 'FirmwareIntegrityError',
      kind: 'missing',
    })
  })

  it('missing-manifest error message includes the manifest URL and the underlying reason', async () => {
    downloadTextMock.mockRejectedValueOnce(new Error('HTTP 404'))

    let caught: unknown
    try {
      await verifyFirmwareSha256(FIXTURE_BUFFER, 'https://example.test/fw.bin.sha256')
    } catch (err: unknown) {
      caught = err
    }
    const err = caught as FirmwareIntegrityError
    expect(err.message).toContain('https://example.test/fw.bin.sha256')
    expect(err.message).toContain('HTTP 404')
  })
})

describe('verifyFirmwareSha256 — malformed manifest', () => {
  it('throws FirmwareIntegrityError(kind:"malformed") when the body is not a valid digest', async () => {
    downloadTextMock.mockResolvedValueOnce('<html>not what you expected</html>')

    await expect(
      verifyFirmwareSha256(FIXTURE_BUFFER, 'https://x/firmware.bin.sha256')
    ).rejects.toMatchObject({
      name: 'FirmwareIntegrityError',
      kind: 'malformed',
    })
  })

  it('throws on an empty manifest body', async () => {
    downloadTextMock.mockResolvedValueOnce('')

    await expect(
      verifyFirmwareSha256(FIXTURE_BUFFER, 'https://x/firmware.bin.sha256')
    ).rejects.toMatchObject({
      name: 'FirmwareIntegrityError',
      kind: 'malformed',
    })
  })

  it('throws on a truncated 63-char hex digest', async () => {
    downloadTextMock.mockResolvedValueOnce('a'.repeat(63))

    await expect(
      verifyFirmwareSha256(FIXTURE_BUFFER, 'https://x/firmware.bin.sha256')
    ).rejects.toMatchObject({
      name: 'FirmwareIntegrityError',
      kind: 'malformed',
    })
  })
})

// firmware-integrity.service.ts — Pre-flash SHA-256 verification for
// downloaded firmware artifacts (#671).
//
// The studio downloads firmware binaries from `objects.githubusercontent.com`
// (a public CDN, no integrity headers) and hands the raw bytes to esptool-js
// for flashing. Without an out-of-band integrity check, a compromised mirror
// or in-flight tampering would be flashed silently.
//
// Mitigation: every release publishes a sibling `.sha256` text file. Before
// any byte reaches `loader.writeFlash`, the hook fetches that sibling and
// recomputes the digest of the downloaded buffer. A mismatch — or a missing
// sibling — aborts the flash unconditionally. There is no opt-out flag.

import { firmwareIpc } from './ipc.service'

/**
 * Thrown when the downloaded firmware buffer fails its SHA-256 check against
 * the manifest, or when the `.sha256` sibling is missing/malformed. The hook
 * propagates this through its normal error path so the UI's toast + error
 * banner already surface it; the dedicated type lets callers branch on it
 * (and lets tests assert specific failure modes).
 */
export class FirmwareIntegrityError extends Error {
  readonly kind: 'mismatch' | 'missing' | 'malformed'
  readonly expected: string | null
  readonly actual: string | null

  constructor(
    kind: 'mismatch' | 'missing' | 'malformed',
    message: string,
    expected: string | null = null,
    actual: string | null = null
  ) {
    super(message)
    this.name = 'FirmwareIntegrityError'
    this.kind = kind
    this.expected = expected
    this.actual = actual
  }
}

// SHA-256 hex digests are 64 hex chars. The shasum/openssl/coreutils format
// is "<hex>  <filename>" — accept either bare hex or hex + whitespace +
// optional filename. Anything else is rejected as malformed so we never
// "succeed" against a truncated or corrupted manifest.
const SHA256_HEX_RE = /^([0-9a-f]{64})(?:[ \t]+\S.*)?$/i

/** UTF-8 BOM (U+FEFF) — kept as an escape so the source file stays ASCII. */
const BOM_RE = /^\uFEFF/

/**
 * Parses the body of a `.sha256` sibling. Returns the lowercased 64-char hex
 * digest, or `null` if no usable line was found.
 *
 * Tolerates: leading whitespace, trailing newlines, BOM, blank lines, and the
 * coreutils `<hex>  <filename>` layout. Rejects any other shape — silent
 * acceptance of a malformed file would defeat the whole check.
 */
export function parseSha256Manifest(raw: string): string | null {
  // Strip BOM and normalise line endings.
  const cleaned = raw.replace(BOM_RE, '').replace(/\r\n?/g, '\n')
  for (const line of cleaned.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.length === 0) continue
    const match = SHA256_HEX_RE.exec(trimmed)
    if (match?.[1] === undefined) return null
    return match[1].toLowerCase()
  }
  return null
}

/**
 * Computes the SHA-256 of `buffer` using the renderer's Web Crypto API. We
 * stay in the renderer (rather than IPC'ing back to Node's `crypto`) because
 * the freshly-downloaded bytes already live here as an `ArrayBuffer` — round-
 * tripping them through IPC would double the memory footprint of a multi-MB
 * firmware image with no security benefit.
 */
export async function computeSha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  const bytes = new Uint8Array(digest)
  let hex = ''
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, '0')
  }
  return hex
}

/**
 * Constant-time string comparison. SHA-256 verification doesn't strictly need
 * timing safety (the expected digest is public), but a constant-time path is
 * cheap and avoids any future surprise if this helper is reused for an HMAC
 * trailer (which IS timing-sensitive).
 */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Verifies that the downloaded firmware buffer matches its published SHA-256
 * manifest. Throws `FirmwareIntegrityError` on every failure mode — caller
 * is expected to surface the message to the user and refuse to flash.
 *
 * `manifestUrl` is the sibling URL (typically `${firmwareUrl}.sha256`). The
 * hook computes it from the firmware download URL and passes both in
 * explicitly so this helper doesn't have to encode URL conventions.
 *
 * On success, returns the verified hex digest (useful for log lines).
 */
export async function verifyFirmwareSha256(
  buffer: ArrayBuffer,
  manifestUrl: string
): Promise<string> {
  let manifestBody: string
  try {
    manifestBody = await firmwareIpc.downloadText(manifestUrl)
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new FirmwareIntegrityError(
      'missing',
      `Firmware rejected: could not fetch SHA-256 manifest (${manifestUrl}). ${reason}`
    )
  }

  const expected = parseSha256Manifest(manifestBody)
  if (expected === null) {
    throw new FirmwareIntegrityError(
      'malformed',
      `Firmware rejected: SHA-256 manifest at ${manifestUrl} is malformed or empty`
    )
  }

  const actual = await computeSha256Hex(buffer)
  if (!timingSafeEqualHex(actual, expected)) {
    throw new FirmwareIntegrityError(
      'mismatch',
      `Firmware rejected: SHA-256 mismatch (expected ${expected}, got ${actual}). ` +
        `The downloaded image does not match the publisher's manifest — refusing to flash.`,
      expected,
      actual
    )
  }

  return actual
}

// ota.service.test.ts — fetchReleases, downloadFirmware, verifyFirmware,
// pushFirmware (HMAC trailer staging)
//
// We mock `expo-file-system` to a tiny in-memory FS so we can drive the
// service without touching a real device. Network calls go through a
// jest-mocked global `fetch`. `expo-constants` is mocked so the OTA secret
// loader returns the dev fallback deterministically.

// ---------------------------------------------------------------------------
// In-memory expo-file-system mock
// ---------------------------------------------------------------------------

interface MockFile {
  bytes: Uint8Array
}

const mockFs: Record<string, MockFile> = {}

let mockNextDownloadBytes: Uint8Array = new Uint8Array(0)
let mockNextDownloadShouldThrow: Error | null = null

jest.mock('expo-file-system', () => {
  // Inline base64 codecs — jest forbids referencing top-level `Buffer` from
  // the mock factory, so we use the global `btoa` / `atob` over binary
  // strings.
  const bytesToBase64 = (bytes: Uint8Array): string => {
    let s = ''
    for (const b of bytes) s += String.fromCharCode(b)
    return btoa(s)
  }
  const base64ToBytes = (b64: string): Uint8Array => {
    const s = atob(b64)
    const out = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
    return out
  }

  return {
    cacheDirectory: 'file:///cache/',
    EncodingType: { Base64: 'base64', UTF8: 'utf8' },

    getInfoAsync: jest.fn((uri: string) => {
      const f = mockFs[uri]
      if (!f) return Promise.resolve({ exists: false })
      return Promise.resolve({ exists: true, size: f.bytes.length, uri })
    }),

    deleteAsync: jest.fn((uri: string) => {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete mockFs[uri]
      return Promise.resolve()
    }),

    readAsStringAsync: jest.fn((uri: string) => {
      const f = mockFs[uri]
      if (!f) return Promise.reject(new Error(`mock fs: file not found: ${uri}`))
      return Promise.resolve(bytesToBase64(f.bytes))
    }),

    writeAsStringAsync: jest.fn((uri: string, contents: string) => {
      mockFs[uri] = { bytes: base64ToBytes(contents) }
      return Promise.resolve()
    }),

    createDownloadResumable: jest.fn(
      (
        _url: string,
        dest: string,
        _opts: unknown,
        onProgress?: (p: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void
      ) => ({
        downloadAsync: () => {
          if (mockNextDownloadShouldThrow) {
            const e = mockNextDownloadShouldThrow
            mockNextDownloadShouldThrow = null
            return Promise.reject(e)
          }
          mockFs[dest] = { bytes: mockNextDownloadBytes }
          onProgress?.({
            totalBytesWritten: mockNextDownloadBytes.length,
            totalBytesExpectedToWrite: mockNextDownloadBytes.length,
          })
          return Promise.resolve({ uri: dest })
        },
      })
    ),
  }
})

// expo-constants — drive the OTA secret loader to its dev fallback so HMAC
// vectors are reproducible and cross-platform stable.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} } },
}))

// ---------------------------------------------------------------------------
// Imports under test (after mocks are registered)
// ---------------------------------------------------------------------------

import { Buffer } from 'buffer'
import { downloadFirmware, pushFirmware, verifyFirmware, type FirmwareRelease } from './ota.service'
import { OtaServiceError } from './ota.errors'
import { hmacSha256 } from './ota-hmac'
import { DEV_INSECURE_OTA_SECRET } from './ota-secret'
import { bytesToHex, sha256Hex } from './sha256'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetMocks(): void {
  for (const k of Object.keys(mockFs)) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete mockFs[k]
  }
  mockNextDownloadBytes = new Uint8Array(0)
  mockNextDownloadShouldThrow = null
}

/**
 * Wire a one-shot interceptor on the mocked `deleteAsync` that snapshots the
 * bytes of `stagedPath` into `out.bytes` just before the file is removed.
 * Used by `pushFirmware` tests because the service discards the staging file
 * after upload, leaving nothing to read from `mockFs` once the call returns.
 */
function captureStagedOnDelete(out: { bytes?: Uint8Array }, stagedPath: string): void {
  // jest.requireMock returns the same module factory we registered above, so
  // we know the shape; the `unknown` cast keeps the boundary explicit without
  // pulling in @types/expo-file-system here.
  const fs = jest.requireMock('expo-file-system') as unknown as { deleteAsync: jest.Mock }
  const originalDeleteAsync = fs.deleteAsync.getMockImplementation()
  fs.deleteAsync.mockImplementationOnce((uri: string, opts?: unknown): Promise<void> => {
    if (uri === stagedPath) {
      const file = mockFs[stagedPath]
      if (file) out.bytes = file.bytes
    }
    if (originalDeleteAsync) {
      return originalDeleteAsync(uri, opts) as Promise<void>
    }
    return Promise.resolve()
  })
}

// ---------------------------------------------------------------------------
// Tests

describe('downloadFirmware', () => {
  beforeEach(resetMocks)

  const release: FirmwareRelease = {
    version: '0.7.1',
    publishedAt: '2026-05-01T10:00:00Z',
    notes: '',
    downloadUrl: 'https://example.com/fw.bin',
    sizeBytes: 4,
    sha256: null,
  }

  it('downloads and caches the binary', async () => {
    mockNextDownloadBytes = new Uint8Array([1, 2, 3, 4])
    const path = await downloadFirmware(release)
    expect(path).toBe('file:///cache/canshift-0.7.1.bin')
    expect(mockFs[path]?.bytes).toEqual(new Uint8Array([1, 2, 3, 4]))
  })

  it('reuses a cached file when sizes match (skips re-download)', async () => {
    mockFs['file:///cache/canshift-0.7.1.bin'] = {
      bytes: new Uint8Array([1, 2, 3, 4]),
    }
    mockNextDownloadShouldThrow = new Error('should not have been called')
    await expect(downloadFirmware(release)).resolves.toBe('file:///cache/canshift-0.7.1.bin')
  })

  it('drops a stale cache (size mismatch) and re-downloads', async () => {
    mockFs['file:///cache/canshift-0.7.1.bin'] = {
      bytes: new Uint8Array([9, 9]),
    }
    mockNextDownloadBytes = new Uint8Array([1, 2, 3, 4])
    const path = await downloadFirmware(release)
    expect(mockFs[path]?.bytes).toEqual(new Uint8Array([1, 2, 3, 4]))
  })

  it('throws OtaServiceError(download-failed) when the download throws', async () => {
    mockNextDownloadShouldThrow = new Error('connection reset')
    await expect(downloadFirmware(release)).rejects.toMatchObject({
      cause: { kind: 'download-failed', reason: 'connection reset' },
    })
  })

  it('reports progress monotonically', async () => {
    mockNextDownloadBytes = new Uint8Array([1, 2, 3, 4])
    const seen: number[] = []
    await downloadFirmware(release, (p) => seen.push(p))
    expect(seen.length).toBeGreaterThan(0)
    expect(seen[seen.length - 1]).toBe(1)
  })
})

// ---------------------------------------------------------------------------

describe('verifyFirmware', () => {
  beforeEach(resetMocks)

  const path = 'file:///cache/canshift-0.7.1.bin'
  const bytes = new Uint8Array([1, 2, 3, 4])

  it('passes when the file exists and size matches', async () => {
    mockFs[path] = { bytes }
    const release: FirmwareRelease = {
      version: '0.7.1',
      publishedAt: '',
      notes: '',
      downloadUrl: '',
      sizeBytes: bytes.length,
      sha256: null,
    }
    await expect(verifyFirmware(path, release)).resolves.toBeUndefined()
  })

  it('passes regardless of the published sha256 (checksum is deferred to staging)', async () => {
    // Issue #706: SHA-256 verification was moved into stageFirmwareWithHmac so
    // the firmware bytes are read off disk exactly once. verifyFirmware now
    // only enforces the size precondition before the Wi-Fi switch.
    mockFs[path] = { bytes }
    const release: FirmwareRelease = {
      version: '0.7.1',
      publishedAt: '',
      notes: '',
      downloadUrl: '',
      sizeBytes: bytes.length,
      sha256: 'f'.repeat(64),
    }
    await expect(verifyFirmware(path, release)).resolves.toBeUndefined()
  })

  it('throws size-mismatch when local file is shorter', async () => {
    mockFs[path] = { bytes: new Uint8Array([1, 2, 3]) }
    const release: FirmwareRelease = {
      version: '0.7.1',
      publishedAt: '',
      notes: '',
      downloadUrl: '',
      sizeBytes: 4,
      sha256: null,
    }
    await expect(verifyFirmware(path, release)).rejects.toBeInstanceOf(OtaServiceError)
    await expect(verifyFirmware(path, release)).rejects.toMatchObject({
      cause: { kind: 'size-mismatch', expected: 4, actual: 3 },
    })
  })

  it('throws size-mismatch when the local file is missing', async () => {
    const release: FirmwareRelease = {
      version: '0.7.1',
      publishedAt: '',
      notes: '',
      downloadUrl: '',
      sizeBytes: 4,
      sha256: null,
    }
    await expect(verifyFirmware(path, release)).rejects.toMatchObject({
      cause: { kind: 'size-mismatch', expected: 4, actual: 0 },
    })
  })
})

// ---------------------------------------------------------------------------

describe('pushFirmware (HMAC-trailer staging)', () => {
  // Minimal XHR mock — drives the multipart upload through to a configurable
  // terminal status so we can assert what was sent. The constructor records
  // each instance into `lastXhr` to avoid `this`-aliasing inside `send()`.
  class MockXhr {
    method: string | null = null
    url: string | null = null
    body: FormData | null = null
    timeout = 0
    upload: { onprogress: ((e: ProgressEvent) => void) | null } = {
      onprogress: null,
    }
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    ontimeout: (() => void) | null = null
    status = 0

    constructor() {
      // Tracking the most recently constructed instance is the most
      // straightforward way to assert XHR semantics in this test. The
      // alternative (a "hasInstance" tracker) is more code for no benefit.
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      lastXhr = this
    }

    open(method: string, url: string): void {
      this.method = method
      this.url = url
    }

    send(body: FormData): void {
      this.body = body
      // Deliver result on the next microtask so the caller can attach its
      // handlers before they fire — matches real XHR semantics.
      queueMicrotask(() => {
        this.status = nextStatus
        this.onload?.()
      })
    }
  }

  let lastXhr: MockXhr | null = null
  let nextStatus = 200

  beforeEach(() => {
    resetMocks()
    lastXhr = null
    nextStatus = 200
    ;(global as unknown as { XMLHttpRequest: new () => MockXhr }).XMLHttpRequest = MockXhr
  })

  const localPath = 'file:///cache/canshift-0.7.1.bin'
  const firmwareBytes = new Uint8Array([0x10, 0x20, 0x30, 0x40, 0x50, 0x60])
  const firmwareDigest = sha256Hex(firmwareBytes)

  function makeRelease(overrides: Partial<FirmwareRelease> = {}): FirmwareRelease {
    return {
      version: '0.7.1',
      publishedAt: '',
      notes: '',
      downloadUrl: '',
      sizeBytes: firmwareBytes.length,
      sha256: firmwareDigest,
      ...overrides,
    }
  }

  it('writes a staging file with payload + 32-byte HMAC trailer, then uploads it', async () => {
    mockFs[localPath] = { bytes: firmwareBytes }

    // pushFirmware deletes the staging file after upload, so snapshot the
    // staged bytes the moment `deleteAsync` is called.
    const stagedSnapshot: { bytes?: Uint8Array } = {}
    captureStagedOnDelete(stagedSnapshot, `${localPath}.hmac.bin`)

    await pushFirmware(localPath, makeRelease())

    const staged = stagedSnapshot.bytes ?? new Uint8Array(0)
    expect(staged.length).toBe(firmwareBytes.length + 32)

    // Original payload bytes are preserved
    expect(staged.subarray(0, firmwareBytes.length)).toEqual(firmwareBytes)

    // Trailer matches HMAC-SHA256(devSecret, firmware)
    const trailer = staged.subarray(firmwareBytes.length)
    const expectedTrailer = hmacSha256(
      new Uint8Array(Buffer.from(DEV_INSECURE_OTA_SECRET, 'utf8')),
      firmwareBytes
    )
    expect(bytesToHex(trailer)).toBe(bytesToHex(expectedTrailer))

    // The XHR was POSTed to the OTA endpoint.
    expect(lastXhr).not.toBeNull()
    expect(lastXhr?.method).toBe('POST')
    expect(lastXhr?.url).toContain('/ota')
  })

  it('leaves the original cached download intact', async () => {
    mockFs[localPath] = { bytes: firmwareBytes }
    await pushFirmware(localPath, makeRelease())
    expect(mockFs[localPath].bytes).toEqual(firmwareBytes)
  })

  it('discards the staging file after a successful upload', async () => {
    mockFs[localPath] = { bytes: firmwareBytes }
    await pushFirmware(localPath, makeRelease())
    expect(mockFs[`${localPath}.hmac.bin`]).toBeUndefined()
  })

  it('discards the staging file even when the upload fails', async () => {
    mockFs[localPath] = { bytes: firmwareBytes }
    nextStatus = 500
    await expect(pushFirmware(localPath, makeRelease())).rejects.toBeInstanceOf(OtaServiceError)
    expect(mockFs[`${localPath}.hmac.bin`]).toBeUndefined()
  })

  it('skips the sha256 check when the release has no published digest', async () => {
    mockFs[localPath] = { bytes: firmwareBytes }
    await expect(pushFirmware(localPath, makeRelease({ sha256: null }))).resolves.toBeUndefined()
  })

  it('throws checksum-mismatch when the staged bytes do not match the release digest', async () => {
    mockFs[localPath] = { bytes: firmwareBytes }
    await expect(
      pushFirmware(localPath, makeRelease({ sha256: 'f'.repeat(64) }))
    ).rejects.toMatchObject({
      cause: {
        kind: 'checksum-mismatch',
        expected: 'f'.repeat(64),
        actual: firmwareDigest,
      },
    })
  })

  it('throws hmac-prepare-failed when the source file is missing', async () => {
    await expect(pushFirmware(localPath, makeRelease())).rejects.toBeInstanceOf(OtaServiceError)
    await expect(pushFirmware(localPath, makeRelease())).rejects.toMatchObject({
      cause: { kind: 'hmac-prepare-failed' },
    })
  })

  it('forwards device-rejected when the upload returns a 4xx/5xx', async () => {
    mockFs[localPath] = { bytes: firmwareBytes }
    nextStatus = 422
    await expect(pushFirmware(localPath, makeRelease())).rejects.toMatchObject({
      cause: { kind: 'device-rejected', status: 422 },
    })
  })
})

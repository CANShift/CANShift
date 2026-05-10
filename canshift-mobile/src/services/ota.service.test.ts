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
        onProgress?: (p: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void,
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
      }),
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
import {
  downloadFirmware,
  fetchReleases,
  pushFirmware,
  verifyFirmware,
  type FirmwareRelease,
} from './ota.service'
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

interface MockReleaseAsset {
  name: string
  browser_download_url: string
  size: number
  digest?: string | null
}

interface MockRelease {
  tag_name: string
  published_at: string
  body: string
  assets: MockReleaseAsset[]
  draft: boolean
  prerelease: boolean
}

function installFetch(impl: () => Promise<unknown>): jest.Mock {
  const m = jest.fn(impl)
  // The real `fetch` is lib.dom typed; we intentionally pass a stub here so
  // callers can drive happy/error paths from tests without spinning up a
  // server. The single `unknown` cast keeps the boundary explicit.
  ;(global as unknown as { fetch: unknown }).fetch = m
  return m
}

function mockFetchReleases(payload: MockRelease[]): jest.Mock {
  return installFetch(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(payload),
    }),
  )
}

function mockFetchFailure(status: number): jest.Mock {
  return installFetch(() =>
    Promise.resolve({
      ok: false,
      status,
      json: () => Promise.resolve([]),
    }),
  )
}

function mockFetchNetworkError(): jest.Mock {
  return installFetch(() => Promise.reject(new TypeError('Network request failed')))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchReleases', () => {
  beforeEach(resetMocks)

  it('parses stable releases with the firmware-partition asset and digest', async () => {
    mockFetchReleases([
      {
        tag_name: 'v0.7.1',
        published_at: '2026-05-01T10:00:00Z',
        body: 'notes',
        draft: false,
        prerelease: false,
        assets: [
          {
            name: 'canshift-firmware-v0.7.1-crowpanel_28-merged.bin',
            browser_download_url: 'https://example.com/merged.bin',
            size: 1000,
            digest: `sha256:${'b'.repeat(64)}`,
          },
          {
            name: 'canshift-firmware-v0.7.1-crowpanel_28-firmware.bin',
            browser_download_url: 'https://example.com/fw.bin',
            size: 100,
            digest: `sha256:${'a'.repeat(64)}`,
          },
          {
            name: 'canshift-spiffs-v0.7.1-crowpanel_28.bin',
            browser_download_url: 'https://example.com/spiffs.bin',
            size: 500,
            digest: `sha256:${'c'.repeat(64)}`,
          },
        ],
      },
    ])

    const releases = await fetchReleases()
    expect(releases).toHaveLength(1)
    expect(releases[0]).toEqual({
      version: '0.7.1',
      publishedAt: '2026-05-01T10:00:00Z',
      notes: 'notes',
      downloadUrl: 'https://example.com/fw.bin',
      sizeBytes: 100,
      sha256: 'a'.repeat(64),
    })
  })

  it('skips releases that publish only the merged factory image (legacy)', async () => {
    mockFetchReleases([
      {
        tag_name: 'v0.7.0',
        published_at: '2026-04-01T10:00:00Z',
        body: '',
        draft: false,
        prerelease: false,
        assets: [
          {
            name: 'canshift-firmware-v0.7.0-crowpanel_28-merged.bin',
            browser_download_url: 'https://example.com/merged.bin',
            size: 1000,
            digest: null,
          },
          {
            name: 'canshift-spiffs-v0.7.0-crowpanel_28.bin',
            browser_download_url: 'https://example.com/spiffs.bin',
            size: 500,
            digest: null,
          },
        ],
      },
    ])

    expect(await fetchReleases()).toEqual([])
  })

  it('skips drafts and prereleases', async () => {
    mockFetchReleases([
      {
        tag_name: 'v0.8.0',
        published_at: '2026-05-02T10:00:00Z',
        body: '',
        draft: true,
        prerelease: false,
        assets: [
          {
            name: 'canshift-firmware-v0.8.0-crowpanel_28-firmware.bin',
            browser_download_url: 'https://x',
            size: 1,
            digest: null,
          },
        ],
      },
      {
        tag_name: 'v0.8.0-rc1',
        published_at: '2026-05-02T11:00:00Z',
        body: '',
        draft: false,
        prerelease: true,
        assets: [
          {
            name: 'canshift-firmware-v0.8.0-rc1-crowpanel_28-firmware.bin',
            browser_download_url: 'https://x',
            size: 1,
            digest: null,
          },
        ],
      },
    ])

    expect(await fetchReleases()).toEqual([])
  })

  it('skips releases with no firmware-partition asset', async () => {
    mockFetchReleases([
      {
        tag_name: 'v0.7.0',
        published_at: '2026-04-30T10:00:00Z',
        body: '',
        draft: false,
        prerelease: false,
        assets: [
          {
            name: 'README.md',
            browser_download_url: 'https://x',
            size: 1,
            digest: null,
          },
        ],
      },
    ])

    expect(await fetchReleases()).toEqual([])
  })

  it('sets sha256 to null when GitHub digest is missing', async () => {
    mockFetchReleases([
      {
        tag_name: 'v0.6.0',
        published_at: '2026-04-01T10:00:00Z',
        body: '',
        draft: false,
        prerelease: false,
        assets: [
          {
            name: 'canshift-firmware-v0.6.0-crowpanel_28-firmware.bin',
            browser_download_url: 'https://x',
            size: 1,
            // no digest field at all
          },
        ],
      },
    ])

    const releases = await fetchReleases()
    expect(releases[0]?.sha256).toBeNull()
  })

  it('sets sha256 to null for non-sha256 digests (forward compat)', async () => {
    mockFetchReleases([
      {
        tag_name: 'v0.6.1',
        published_at: '2026-04-02T10:00:00Z',
        body: '',
        draft: false,
        prerelease: false,
        assets: [
          {
            name: 'canshift-firmware-v0.6.1-crowpanel_28-firmware.bin',
            browser_download_url: 'https://x',
            size: 1,
            digest: 'sha512:deadbeef',
          },
        ],
      },
    ])

    const releases = await fetchReleases()
    expect(releases[0]?.sha256).toBeNull()
  })

  it('throws OtaServiceError(releases-fetch-failed) on HTTP error', async () => {
    mockFetchFailure(503)
    await expect(fetchReleases()).rejects.toMatchObject({
      cause: { kind: 'releases-fetch-failed', status: 503 },
    })
  })

  it('throws OtaServiceError(releases-fetch-failed) on network error', async () => {
    mockFetchNetworkError()
    await expect(fetchReleases()).rejects.toMatchObject({
      cause: { kind: 'releases-fetch-failed' },
    })
  })
})

// ---------------------------------------------------------------------------

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
    await expect(downloadFirmware(release)).resolves.toBe(
      'file:///cache/canshift-0.7.1.bin',
    )
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
  const digest = sha256Hex(bytes)

  it('passes when size and SHA-256 match', async () => {
    mockFs[path] = { bytes }
    const release: FirmwareRelease = {
      version: '0.7.1',
      publishedAt: '',
      notes: '',
      downloadUrl: '',
      sizeBytes: bytes.length,
      sha256: digest,
    }
    await expect(verifyFirmware(path, release)).resolves.toBeUndefined()
  })

  it('passes (digest skipped) when release has no published sha256', async () => {
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
    await expect(verifyFirmware(path, release)).rejects.toBeInstanceOf(
      OtaServiceError,
    )
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

  it('throws checksum-mismatch when SHA-256 does not match', async () => {
    mockFs[path] = { bytes }
    const release: FirmwareRelease = {
      version: '0.7.1',
      publishedAt: '',
      notes: '',
      downloadUrl: '',
      sizeBytes: bytes.length,
      sha256: 'f'.repeat(64),
    }
    await expect(verifyFirmware(path, release)).rejects.toMatchObject({
      cause: {
        kind: 'checksum-mismatch',
        expected: 'f'.repeat(64),
        actual: digest,
      },
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
    ;(global as unknown as { XMLHttpRequest: new () => MockXhr }).XMLHttpRequest =
      MockXhr
  })

  const localPath = 'file:///cache/canshift-0.7.1.bin'
  const firmwareBytes = new Uint8Array([0x10, 0x20, 0x30, 0x40, 0x50, 0x60])

  it('writes a staging file with payload + 32-byte HMAC trailer, then uploads it', async () => {
    mockFs[localPath] = { bytes: firmwareBytes }

    await pushFirmware(localPath)

    // Staging file exists alongside the original
    const stagedPath = `${localPath}.hmac.bin`
    const staged = mockFs[stagedPath]
    expect(staged).toBeDefined()
    expect(staged?.bytes.length).toBe(firmwareBytes.length + 32)

    // Original payload bytes are preserved
    expect(staged?.bytes.subarray(0, firmwareBytes.length)).toEqual(firmwareBytes)

    // Trailer matches HMAC-SHA256(devSecret, firmware)
    const trailer = staged?.bytes.subarray(firmwareBytes.length) ?? new Uint8Array(0)
    const expectedTrailer = hmacSha256(
      new Uint8Array(Buffer.from(DEV_INSECURE_OTA_SECRET, 'utf8')),
      firmwareBytes,
    )
    expect(bytesToHex(trailer)).toBe(bytesToHex(expectedTrailer))

    // The XHR was POSTed to the OTA endpoint.
    expect(lastXhr).not.toBeNull()
    expect(lastXhr?.method).toBe('POST')
    expect(lastXhr?.url).toContain('/ota')
  })

  it('leaves the original cached download intact', async () => {
    mockFs[localPath] = { bytes: firmwareBytes }
    await pushFirmware(localPath)
    expect(mockFs[localPath].bytes).toEqual(firmwareBytes)
  })

  it('throws hmac-prepare-failed when the source file is missing', async () => {
    await expect(pushFirmware(localPath)).rejects.toBeInstanceOf(OtaServiceError)
    await expect(pushFirmware(localPath)).rejects.toMatchObject({
      cause: { kind: 'hmac-prepare-failed' },
    })
  })

  it('forwards device-rejected when the upload returns a 4xx/5xx', async () => {
    mockFs[localPath] = { bytes: firmwareBytes }
    nextStatus = 422
    await expect(pushFirmware(localPath)).rejects.toMatchObject({
      cause: { kind: 'device-rejected', status: 422 },
    })
  })
})

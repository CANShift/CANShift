// ota.service.test.ts — fetchReleases, downloadFirmware, verifyFirmware
//
// We mock `expo-file-system` to a tiny in-memory FS so we can drive the
// service without touching a real device. Network calls go through a
// jest-mocked global `fetch`.

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
  // Inline base64 encoder — jest forbids referencing top-level `Buffer` from
  // the mock factory, so we use the global `btoa` over a binary string.
  const bytesToBase64 = (bytes: Uint8Array): string => {
    let s = ''
    for (const b of bytes) s += String.fromCharCode(b)
    return btoa(s)
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

// ---------------------------------------------------------------------------
// Imports under test (after mocks are registered)
// ---------------------------------------------------------------------------

import {
  downloadFirmware,
  fetchReleases,
  verifyFirmware,
  type FirmwareRelease,
} from './ota.service'
import { OtaServiceError } from './ota.errors'
import { sha256Hex } from './sha256'

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

  it('parses stable releases with .bin asset and digest', async () => {
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
            browser_download_url: 'https://example.com/fw.bin',
            size: 100,
            digest: `sha256:${'a'.repeat(64)}`,
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
            name: 'fw.bin',
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
            name: 'fw.bin',
            browser_download_url: 'https://x',
            size: 1,
            digest: null,
          },
        ],
      },
    ])

    expect(await fetchReleases()).toEqual([])
  })

  it('skips releases with no .bin asset', async () => {
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
            name: 'fw.bin',
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
            name: 'fw.bin',
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

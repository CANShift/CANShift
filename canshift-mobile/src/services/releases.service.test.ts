// releases.service.test.ts — Cache, retry, rate-limit, validation paths.
//
// We mock the global `fetch` and `expo-secure-store` so the suite never
// touches the network or the device keystore. `Date.now()` is overridden
// per-service so cache TTL assertions stay deterministic.

import { ReleasesService } from './releases.service'

// ---------------------------------------------------------------------------
// expo-secure-store mock — in-memory KV
// ---------------------------------------------------------------------------

const mockSecureStore: Record<string, string> = {}

jest.mock('expo-secure-store', () => ({
  __esModule: true,
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockSecureStore[key] ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockSecureStore[key] = value
    return Promise.resolve()
  }),
  deleteItemAsync: jest.fn((key: string) => {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete mockSecureStore[key]
    return Promise.resolve()
  }),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockResponseShape {
  status?: number
  ok?: boolean
  body?: unknown
  jsonThrows?: boolean
  headers?: Record<string, string>
  /** Reject the fetch call entirely (network error). */
  reject?: Error
}

function makeFetchMock(...queue: MockResponseShape[]): jest.Mock {
  return jest.fn().mockImplementation(() => {
    const next = queue.shift()
    if (!next) return Promise.reject(new Error('fetch mock exhausted'))
    if (next.reject) return Promise.reject(next.reject)
    const status = next.status ?? 200
    const ok = next.ok ?? (status >= 200 && status < 300)
    const headers = new Map(Object.entries(next.headers ?? {}))
    return Promise.resolve({
      status,
      ok,
      headers: {
        get: (name: string) => headers.get(name.toLowerCase()) ?? headers.get(name) ?? null,
      },
      json: () =>
        next.jsonThrows ? Promise.reject(new Error('bad json')) : Promise.resolve(next.body),
    } as unknown as Response)
  })
}

function makeRelease(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    tag_name: 'v0.8.3',
    name: 'CANShift v0.8.3',
    prerelease: false,
    published_at: '2026-05-09T10:00:00Z',
    body: '## What changed\n- thing',
    html_url: 'https://github.com/tburkhalterr/CANShift/releases/tag/v0.8.3',
    assets: [
      {
        name: 'canshift-firmware-v0.8.3.bin',
        browser_download_url: 'https://example.com/firmware.bin',
        size: 1_500_000,
        content_type: 'application/octet-stream',
      },
    ],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReleasesService', () => {
  const originalFetch = global.fetch
  let nowMs = 1_700_000_000_000

  beforeEach(() => {
    for (const key of Object.keys(mockSecureStore)) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete mockSecureStore[key]
    }
    nowMs = 1_700_000_000_000
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  function makeService(): ReleasesService {
    return new ReleasesService({ now: () => nowMs })
  }

  it('returns the latest stable release on a clean fetch', async () => {
    global.fetch = makeFetchMock({ body: [makeRelease()] })
    const svc = makeService()
    const result = await svc.getLatest()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.release.version).toBe('0.8.3')
    expect(result.release.tag).toBe('v0.8.3')
    expect(result.release.assets).toHaveLength(1)
    expect(result.release.assets[0]?.sizeBytes).toBe(1_500_000)
    expect(result.prerelease).toBeNull()
    expect(result.fromCache).toBe(false)
  })

  it('surfaces a separate prerelease when both exist', async () => {
    global.fetch = makeFetchMock({
      body: [
        makeRelease({ tag_name: 'v0.9.0-beta.1', prerelease: true }),
        makeRelease(),
      ],
    })
    const svc = makeService()
    const result = await svc.getLatest()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.release.version).toBe('0.8.3')
    expect(result.prerelease?.version).toBe('0.9.0-beta.1')
  })

  it('falls back to a prerelease when no stable release exists', async () => {
    global.fetch = makeFetchMock({
      body: [makeRelease({ tag_name: 'v0.1.0-beta', prerelease: true })],
    })
    const svc = makeService()
    const result = await svc.getLatest()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.release.version).toBe('0.1.0-beta')
    // When there's no stable, prerelease is reported through `release`,
    // and `prerelease` stays null to avoid duplicate surfacing.
    expect(result.prerelease).toBeNull()
  })

  it('reuses the in-memory cache within the TTL', async () => {
    const fetchMock = makeFetchMock({ body: [makeRelease()] })
    global.fetch = fetchMock
    const svc = makeService()
    await svc.getLatest()
    nowMs += 30_000 // 30 s later — still inside the 5 min TTL
    const second = await svc.getLatest()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    if (!second.ok) throw new Error('expected ok')
    expect(second.fromCache).toBe(true)
  })

  it('refetches when force=true bypasses the cache', async () => {
    const fetchMock = makeFetchMock(
      { body: [makeRelease()] },
      { body: [makeRelease({ tag_name: 'v0.8.4' })] },
    )
    global.fetch = fetchMock
    const svc = makeService()
    await svc.getLatest()
    const second = await svc.getLatest(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    if (!second.ok) throw new Error('expected ok')
    expect(second.release.version).toBe('0.8.4')
  })

  it('retries 5xx once', async () => {
    const fetchMock = makeFetchMock(
      { status: 502, ok: false },
      { body: [makeRelease()] },
    )
    global.fetch = fetchMock
    const svc = makeService()
    const result = await svc.getLatest()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.ok).toBe(true)
  })

  it('does not retry 4xx responses', async () => {
    const fetchMock = makeFetchMock({ status: 404, ok: false })
    global.fetch = fetchMock
    const svc = makeService()
    const result = await svc.getLatest()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('http-error')
  })

  it('surfaces rate-limit failures and honours the cooldown window', async () => {
    const fetchMock = makeFetchMock(
      { status: 429, ok: false, headers: { 'retry-after': '60' } },
      { body: [makeRelease()] },
    )
    global.fetch = fetchMock
    const svc = makeService()
    const first = await svc.getLatest()
    expect(first.ok).toBe(false)
    if (first.ok) return
    expect(first.reason).toBe('rate-limited')

    // Inside the cooldown window — service must NOT hit the network again.
    const second = await svc.getLatest()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.reason).toBe('rate-limited')
  })

  it('returns offline when fetch throws (network error)', async () => {
    global.fetch = makeFetchMock({ reject: new Error('Network request failed') })
    const svc = makeService()
    const result = await svc.getLatest()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('offline')
  })

  it('returns invalid-response when JSON parsing fails', async () => {
    global.fetch = makeFetchMock({ jsonThrows: true })
    const svc = makeService()
    const result = await svc.getLatest()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('invalid-response')
  })

  it('returns invalid-response when payload is not an array', async () => {
    global.fetch = makeFetchMock({ body: { message: 'Not Found' } })
    const svc = makeService()
    const result = await svc.getLatest()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('invalid-response')
  })

  it('filters out malformed releases without rejecting the whole response', async () => {
    global.fetch = makeFetchMock({
      body: [
        { tag_name: 12345 }, // garbage
        makeRelease(),
      ],
    })
    const svc = makeService()
    const result = await svc.getLatest()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.release.version).toBe('0.8.3')
  })

  it('hydrates from the persistent cache when available', async () => {
    mockSecureStore['canshift.releases.lastPayload'] = JSON.stringify({
      release: {
        version: '0.8.2',
        tag: 'v0.8.2',
        name: 'cached',
        notes: '',
        publishedAt: '2026-05-08T10:00:00Z',
        prerelease: false,
        htmlUrl: 'https://example.com',
        assets: [],
      },
      prerelease: null,
      fetchedAt: nowMs - 1000, // fresh cache
    })
    // No live fetch should fire — cache is fresh.
    const fetchMock = jest.fn()
    global.fetch = fetchMock
    const svc = makeService()
    const result = await svc.getLatest()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.release.version).toBe('0.8.2')
    expect(result.fromCache).toBe(true)
  })

  it('keeps the cached payload alongside a failure result', async () => {
    // Prime the cache, then fail on a forced refresh.
    global.fetch = makeFetchMock({ body: [makeRelease()] })
    const svc = makeService()
    await svc.getLatest()
    global.fetch = makeFetchMock({ reject: new Error('boom') })
    const second = await svc.getLatest(true)
    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.cached?.release.version).toBe('0.8.3')
  })
})

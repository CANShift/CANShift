// releases.service.test.ts — Locks the IPC payload shape and cache behaviour
// of the studio's GitHub releases probe (issue #571).
//
// The service is the only piece of #571's main-side surface that has shape
// risk: untrusted JSON from GitHub flows straight to the renderer, and the
// type guards are the only barrier between a malformed release and a card
// crash. Coverage:
//   - happy path (latest stable + latest pre-release picked correctly)
//   - cache TTL (no second fetch within the window)
//   - 5xx single retry vs 4xx fail-fast
//   - 403/429 rate-limit handling with Retry-After cool-down
//   - offline / invalid JSON / malformed array branches
//   - graceful "no releases yet" fallback
//
// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest'

const netMock = vi.hoisted(() => ({
  fetch: vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(),
}))

vi.mock('electron', () => ({ net: netMock }))

import { ReleasesService } from './releases.service'

interface PartialRelease {
  tag_name?: unknown
  name?: unknown
  prerelease?: unknown
  published_at?: unknown
  body?: unknown
  html_url?: unknown
  assets?: unknown
}

function jsonResponse(
  body: unknown,
  init: { ok?: boolean; status?: number; headers?: Record<string, string> } = {}
): Response {
  const ok = init.ok ?? true
  const status = init.status ?? 200
  const headers = new Map(Object.entries(init.headers ?? {}))
  return {
    ok,
    status,
    headers: {
      get: (name: string): string | null => headers.get(name.toLowerCase()) ?? null,
    },
    json: (): Promise<unknown> => Promise.resolve(body),
  } as unknown as Response
}

function makeRelease(overrides: PartialRelease = {}): PartialRelease {
  return {
    tag_name: 'v0.8.3',
    name: 'CANShift 0.8.3',
    prerelease: false,
    published_at: '2026-05-09T12:00:00Z',
    body: '## Changelog\n- fix\n',
    html_url: 'https://github.com/tburkhalterr/CANShift/releases/tag/v0.8.3',
    assets: [
      {
        name: 'cs-studio-0.8.3.dmg',
        browser_download_url: 'https://example.test/cs-studio-0.8.3.dmg',
        size: 1_234_567,
        content_type: 'application/x-apple-diskimage',
      },
    ],
    ...overrides,
  }
}

beforeEach(() => {
  netMock.fetch.mockReset()
})

describe('ReleasesService.getLatest — happy path', () => {
  it('returns the latest stable release verbatim from the API', async () => {
    netMock.fetch.mockResolvedValueOnce(jsonResponse([makeRelease()]))
    const svc = new ReleasesService({ now: () => 1_000 })

    const result = await svc.getLatest()

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.release.version).toBe('0.8.3')
    expect(result.release.tag).toBe('v0.8.3')
    expect(result.release.name).toBe('CANShift 0.8.3')
    expect(result.release.prerelease).toBe(false)
    expect(result.release.notes).toMatch(/Changelog/)
    expect(result.release.htmlUrl).toBe(
      'https://github.com/tburkhalterr/CANShift/releases/tag/v0.8.3'
    )
    expect(result.release.assets).toEqual([
      {
        name: 'cs-studio-0.8.3.dmg',
        downloadUrl: 'https://example.test/cs-studio-0.8.3.dmg',
        sizeBytes: 1_234_567,
        contentType: 'application/x-apple-diskimage',
      },
    ])
    expect(result.prerelease).toBeNull()
    expect(result.fromCache).toBe(false)
    expect(result.fetchedAt).toBe(new Date(1_000).toISOString())
  })

  it('exposes the latest pre-release alongside the latest stable', async () => {
    netMock.fetch.mockResolvedValueOnce(
      jsonResponse([
        makeRelease({ tag_name: 'v0.9.0-beta.1', prerelease: true }),
        makeRelease({ tag_name: 'v0.8.3', prerelease: false }),
      ])
    )
    const svc = new ReleasesService()

    const result = await svc.getLatest()

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.release.version).toBe('0.8.3')
    expect(result.prerelease?.version).toBe('0.9.0-beta.1')
  })

  it('falls back to the latest pre-release when no stable exists yet', async () => {
    netMock.fetch.mockResolvedValueOnce(
      jsonResponse([makeRelease({ tag_name: 'v0.1.0-alpha.1', prerelease: true })])
    )
    const svc = new ReleasesService()

    const result = await svc.getLatest()

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.release.version).toBe('0.1.0-alpha.1')
    // The pre-release is mirrored into `release` — there's nothing else to
    // surface separately, so the explicit `prerelease` field stays null.
    expect(result.prerelease).toBeNull()
  })

  it('coerces a missing `name` and missing `body` into null / empty', async () => {
    netMock.fetch.mockResolvedValueOnce(jsonResponse([makeRelease({ name: null, body: null })]))
    const svc = new ReleasesService()

    const result = await svc.getLatest()

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.release.name).toBeNull()
    expect(result.release.notes).toBe('')
  })

  it('omits asset content_type when the API doesnt send one', async () => {
    netMock.fetch.mockResolvedValueOnce(
      jsonResponse([
        makeRelease({
          assets: [
            {
              name: 'asset.bin',
              browser_download_url: 'https://example.test/asset.bin',
              size: 100,
            },
          ],
        }),
      ])
    )
    const svc = new ReleasesService()

    const result = await svc.getLatest()

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    const [asset] = result.release.assets
    expect(asset).toBeDefined()
    expect(asset).not.toHaveProperty('contentType')
  })

  it('passes the User-Agent and Accept headers required by the GitHub API', async () => {
    netMock.fetch.mockResolvedValueOnce(jsonResponse([makeRelease()]))
    const svc = new ReleasesService()

    await svc.getLatest()

    expect(netMock.fetch).toHaveBeenCalledTimes(1)
    const callArgs = netMock.fetch.mock.calls[0]
    expect(callArgs).toBeDefined()
    const url = callArgs?.[0]
    const init = callArgs?.[1]
    expect(url).toMatch(/^https:\/\/api\.github\.com\/repos\/.*\/releases\?per_page=/)
    const headers = (init?.headers ?? {}) as Record<string, string>
    expect(headers['User-Agent']).toBe('CANShift-Studio')
    expect(headers.Accept).toBe('application/vnd.github.v3+json')
  })
})

describe('ReleasesService.getLatest — caching', () => {
  it('reuses the cached payload within the TTL window without re-fetching', async () => {
    netMock.fetch.mockResolvedValueOnce(jsonResponse([makeRelease()]))
    let now = 1_000
    const svc = new ReleasesService({ now: () => now })

    const first = await svc.getLatest()
    expect(first.ok).toBe(true)
    if (!first.ok) throw new Error('unreachable')
    expect(first.fromCache).toBe(false)

    now = 1_000 + 60_000 // one minute later — well within the 5-min TTL
    const second = await svc.getLatest()
    expect(second.ok).toBe(true)
    if (!second.ok) throw new Error('unreachable')
    expect(second.fromCache).toBe(true)
    expect(netMock.fetch).toHaveBeenCalledTimes(1)
  })

  it('refetches after the cache TTL elapses', async () => {
    netMock.fetch.mockResolvedValue(jsonResponse([makeRelease()]))
    let now = 1_000
    const svc = new ReleasesService({ now: () => now })

    await svc.getLatest()
    now = 1_000 + 10 * 60_000
    await svc.getLatest()

    expect(netMock.fetch).toHaveBeenCalledTimes(2)
  })

  it('force = true bypasses the cache', async () => {
    netMock.fetch.mockResolvedValue(jsonResponse([makeRelease()]))
    const svc = new ReleasesService({ now: () => 1_000 })

    await svc.getLatest()
    await svc.getLatest(true)

    expect(netMock.fetch).toHaveBeenCalledTimes(2)
  })

  it('concurrent callers share the same in-flight fetch', async () => {
    let resolveBody: (value: Response) => void = () => undefined
    const pending = new Promise<Response>((resolve) => {
      resolveBody = resolve
    })
    netMock.fetch.mockReturnValueOnce(pending)
    const svc = new ReleasesService()

    const p1 = svc.getLatest()
    const p2 = svc.getLatest()
    resolveBody(jsonResponse([makeRelease()]))

    await Promise.all([p1, p2])
    expect(netMock.fetch).toHaveBeenCalledTimes(1)
  })
})

describe('ReleasesService.getLatest — failure branches', () => {
  it('retries a 5xx once and reports the cached error when the retry fails', async () => {
    netMock.fetch
      .mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 502 }))
      .mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 502 }))
    const svc = new ReleasesService()

    const result = await svc.getLatest()

    expect(netMock.fetch).toHaveBeenCalledTimes(2)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.reason).toBe('http-error')
  })

  it('does not retry a 4xx response (deterministic)', async () => {
    netMock.fetch.mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 404 }))
    const svc = new ReleasesService()

    const result = await svc.getLatest()

    expect(netMock.fetch).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.reason).toBe('http-error')
  })

  it('reports 403 as rate-limited and respects Retry-After (seconds form)', async () => {
    netMock.fetch.mockResolvedValueOnce(
      jsonResponse(null, {
        ok: false,
        status: 403,
        headers: { 'retry-after': '30' },
      })
    )
    let now = 1_000
    const svc = new ReleasesService({ now: () => now })

    const first = await svc.getLatest()
    expect(first.ok).toBe(false)
    if (first.ok) throw new Error('unreachable')
    expect(first.reason).toBe('rate-limited')

    // While the cool-down is active, the service must not fetch again.
    now = 1_000 + 10_000
    const second = await svc.getLatest()
    expect(netMock.fetch).toHaveBeenCalledTimes(1)
    expect(second.ok).toBe(false)
    if (second.ok) throw new Error('unreachable')
    expect(second.reason).toBe('rate-limited')
  })

  it('reports 429 as rate-limited', async () => {
    netMock.fetch.mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 429 }))
    const svc = new ReleasesService()

    const result = await svc.getLatest()

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.reason).toBe('rate-limited')
  })

  it('reports network errors as offline', async () => {
    netMock.fetch.mockRejectedValueOnce(new Error('ENOTFOUND'))
    const svc = new ReleasesService()

    const result = await svc.getLatest()

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.reason).toBe('offline')
    expect(result.message).toMatch(/ENOTFOUND/)
  })

  it('reports a non-array response as invalid', async () => {
    netMock.fetch.mockResolvedValueOnce(jsonResponse({ not: 'an array' }))
    const svc = new ReleasesService()

    const result = await svc.getLatest()

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.reason).toBe('invalid-response')
  })

  it('drops malformed releases without throwing', async () => {
    netMock.fetch.mockResolvedValueOnce(
      jsonResponse([
        // Missing tag_name — must be skipped.
        { prerelease: false, published_at: '2026-01-01T00:00:00Z', assets: [] },
        // null entry — must be skipped.
        null,
        // Valid release.
        makeRelease({ tag_name: 'v0.7.1' }),
      ])
    )
    const svc = new ReleasesService()

    const result = await svc.getLatest()

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.release.version).toBe('0.7.1')
  })

  it('reports "no releases" when the API returns an empty array', async () => {
    netMock.fetch.mockResolvedValueOnce(jsonResponse([]))
    const svc = new ReleasesService()

    const result = await svc.getLatest()

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.reason).toBe('invalid-response')
  })

  it('returns a cached payload alongside a later failure', async () => {
    netMock.fetch
      .mockResolvedValueOnce(jsonResponse([makeRelease()]))
      .mockRejectedValueOnce(new Error('offline now'))
    let now = 1_000
    const svc = new ReleasesService({ now: () => now })

    await svc.getLatest()
    now = 1_000 + 10 * 60_000 // past the TTL so we try to refetch
    const failure = await svc.getLatest()

    expect(failure.ok).toBe(false)
    if (failure.ok) throw new Error('unreachable')
    expect(failure.reason).toBe('offline')
    expect(failure.cached).not.toBeNull()
    expect(failure.cached?.release.version).toBe('0.8.3')
  })
})

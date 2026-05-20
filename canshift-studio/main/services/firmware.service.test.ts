// firmware.service.test.ts — coverage for the GitHub releases parser, the
// stable/beta channel filter, and the payloadBytes plumbing landed in #304.
//
// listReleases is the only piece of the FirmwareService that has shape risk:
// untrusted JSON from GitHub flows directly into the renderer, and the type
// guards are the only thing standing between a malformed release and a crash.
//
// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest'

const netMock = vi.hoisted(() => ({
  fetch: vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(),
}))

// Hoisted block — vi.mock factories run before module-level imports. The
// recording stub captures every open/set/close call against the SerialPort
// mock so the reset-sequence tests (#482) can assert the exact call order.
const serialRecorder = vi.hoisted(() => {
  interface Signals {
    dtr: boolean
    rts: boolean
  }
  type Call =
    | { kind: 'open' }
    | { kind: 'set'; signals: Signals }
    | { kind: 'close' }
    | { kind: 'sleep'; ms: number }
  const calls: Call[] = []

  // Per-instance counters so a test can target the Nth instance specifically
  // (instance 1 = first reset pass, instance 2 = second reset pass).
  let instanceIndex = 0

  // Failure injectors — keyed by `${instanceIndex}:${stage}`.
  // stage ∈ { 'open', 'set', 'close' }
  const failures = new Map<string, Error>()

  const failKey = (idx: number, stage: 'open' | 'set' | 'close'): string =>
    `${String(idx)}:${stage}`

  function reset(): void {
    calls.length = 0
    failures.clear()
    instanceIndex = 0
  }

  function injectFailure(idx: number, stage: 'open' | 'set' | 'close', err: Error): void {
    failures.set(failKey(idx, stage), err)
  }

  class SerialPortStub {
    private readonly idx: number
    constructor(_opts: { path: string; baudRate: number; autoOpen: boolean }) {
      instanceIndex += 1
      this.idx = instanceIndex
    }
    open(cb: (err: Error | null) => void): void {
      calls.push({ kind: 'open' })
      const err = failures.get(failKey(this.idx, 'open'))
      // Async ack to mirror the real serialport library — handlers on
      // process.nextTick avoid leaking call-order races into the recorder.
      queueMicrotask(() => {
        cb(err ?? null)
      })
    }
    set(signals: Signals, cb: (err: Error | null) => void): void {
      calls.push({ kind: 'set', signals })
      const err = failures.get(failKey(this.idx, 'set'))
      queueMicrotask(() => {
        cb(err ?? null)
      })
    }
    close(cb: (err: Error | null) => void): void {
      calls.push({ kind: 'close' })
      const err = failures.get(failKey(this.idx, 'close'))
      queueMicrotask(() => {
        cb(err ?? null)
      })
    }
  }

  return { calls, reset, injectFailure, SerialPortStub }
})

vi.mock('electron', () => ({ net: netMock }))
vi.mock('serialport', () => ({ SerialPort: serialRecorder.SerialPortStub }))

import { FirmwareService } from './firmware.service'

interface PartialAsset {
  name?: unknown
  browser_download_url?: unknown
  size?: unknown
}

interface PartialRelease {
  tag_name?: unknown
  prerelease?: unknown
  published_at?: unknown
  body?: unknown
  assets?: unknown
}

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}): Response {
  const ok = init.ok ?? true
  const status = init.status ?? 200
  return {
    ok,
    status,
    json: (): Promise<unknown> => Promise.resolve(body),
  } as unknown as Response
}

function fwAsset(version: string, size: number): PartialAsset {
  return {
    name: `canshift-firmware-${version}-crowpanel_28-merged.bin`,
    browser_download_url: `https://example.test/fw-${version}.bin`,
    size,
  }
}

function spiffsAsset(version: string, size: number): PartialAsset {
  return {
    name: `canshift-spiffs-${version}-crowpanel_28.bin`,
    browser_download_url: `https://example.test/spiffs-${version}.bin`,
    size,
  }
}

function makeRelease(overrides: PartialRelease = {}): PartialRelease {
  return {
    tag_name: 'v0.7.1',
    prerelease: false,
    published_at: '2026-01-01T00:00:00Z',
    body: 'Release notes',
    assets: [fwAsset('0.7.1', 1_234_567), spiffsAsset('0.7.1', 50_000)],
    ...overrides,
  }
}

beforeEach(() => {
  netMock.fetch.mockReset()
})

describe('FirmwareService.listReleases — channel filtering', () => {
  it('returns only non-prerelease items on the "stable" channel', async () => {
    netMock.fetch.mockResolvedValueOnce(
      jsonResponse([
        makeRelease({ tag_name: 'v0.7.1', prerelease: false }),
        makeRelease({ tag_name: 'v0.8.0-beta.1', prerelease: true }),
        makeRelease({ tag_name: 'v0.7.0', prerelease: false }),
      ])
    )

    const service = new FirmwareService()
    const releases = await service.listReleases('stable')

    expect(releases).toHaveLength(2)
    expect(releases.map((r) => r.version)).toEqual(['0.7.1', '0.7.0'])
    expect(releases.every((r) => !r.prerelease)).toBe(true)
  })

  it('returns stable + prerelease on the "beta" channel', async () => {
    netMock.fetch.mockResolvedValueOnce(
      jsonResponse([
        makeRelease({ tag_name: 'v0.7.1', prerelease: false }),
        makeRelease({ tag_name: 'v0.8.0-beta.1', prerelease: true }),
      ])
    )

    const service = new FirmwareService()
    const releases = await service.listReleases('beta')

    expect(releases).toHaveLength(2)
    expect(releases.map((r) => r.version)).toEqual(['0.7.1', '0.8.0-beta.1'])
  })

  it('strips the leading "v" from tag_name to produce a semver version', async () => {
    netMock.fetch.mockResolvedValueOnce(jsonResponse([makeRelease({ tag_name: 'v1.2.3' })]))

    const service = new FirmwareService()
    const [release] = await service.listReleases('beta')

    expect(release).toBeDefined()
    expect(release?.version).toBe('1.2.3')
    expect(release?.tag).toBe('v1.2.3')
  })

  it('preserves a tag_name that has no leading "v"', async () => {
    netMock.fetch.mockResolvedValueOnce(jsonResponse([makeRelease({ tag_name: '0.7.1' })]))

    const service = new FirmwareService()
    const [release] = await service.listReleases('beta')

    expect(release?.version).toBe('0.7.1')
    expect(release?.tag).toBe('0.7.1')
  })

  it('passes the User-Agent and Accept headers required by the GitHub API', async () => {
    netMock.fetch.mockResolvedValueOnce(jsonResponse([]))

    const service = new FirmwareService()
    await service.listReleases('stable')

    expect(netMock.fetch).toHaveBeenCalledTimes(1)
    const callArgs = netMock.fetch.mock.calls[0]
    expect(callArgs).toBeDefined()
    const url = callArgs?.[0]
    const init = callArgs?.[1]
    expect(url).toMatch(/^https:\/\/api\.github\.com\/repos\/.*\/releases/)
    const headers = (init?.headers ?? {}) as Record<string, string>
    expect(headers['User-Agent']).toBe('CANShift-Studio')
    expect(headers.Accept).toBe('application/vnd.github.v3+json')
  })
})

describe('FirmwareService.listReleases — asset extraction (#304 payloadBytes)', () => {
  it('attaches downloadUrl, spiffsUrl, and payloadBytes from matching assets', async () => {
    netMock.fetch.mockResolvedValueOnce(
      jsonResponse([
        makeRelease({
          tag_name: 'v0.7.1',
          assets: [fwAsset('0.7.1', 2_345_678), spiffsAsset('0.7.1', 99_999)],
        }),
      ])
    )

    const service = new FirmwareService()
    const [release] = await service.listReleases('beta')

    expect(release?.downloadUrl).toBe('https://example.test/fw-0.7.1.bin')
    expect(release?.spiffsUrl).toBe('https://example.test/spiffs-0.7.1.bin')
    expect(release?.payloadBytes).toBe(2_345_678)
  })

  it('omits payloadBytes when the firmware asset is missing', async () => {
    // A release that ships a SPIFFS image but no firmware bin (rare, but
    // possible during partial publishes) must not surface a stale size.
    netMock.fetch.mockResolvedValueOnce(
      jsonResponse([
        makeRelease({
          tag_name: 'v0.7.1',
          assets: [spiffsAsset('0.7.1', 99_999)],
        }),
      ])
    )

    const service = new FirmwareService()
    const [release] = await service.listReleases('beta')

    expect(release?.downloadUrl).toBeUndefined()
    expect(release?.spiffsUrl).toBe('https://example.test/spiffs-0.7.1.bin')
    expect(release?.payloadBytes).toBeUndefined()
  })

  it('omits both URLs when no canshift assets are attached', async () => {
    netMock.fetch.mockResolvedValueOnce(
      jsonResponse([
        makeRelease({
          tag_name: 'v0.7.1',
          assets: [
            { name: 'changelog.md', browser_download_url: 'https://example.test/c.md', size: 10 },
          ],
        }),
      ])
    )

    const service = new FirmwareService()
    const [release] = await service.listReleases('beta')

    expect(release?.downloadUrl).toBeUndefined()
    expect(release?.spiffsUrl).toBeUndefined()
    expect(release?.payloadBytes).toBeUndefined()
  })

  it('coerces a null body into an empty notes string', async () => {
    netMock.fetch.mockResolvedValueOnce(jsonResponse([makeRelease({ body: null })]))

    const service = new FirmwareService()
    const [release] = await service.listReleases('beta')

    expect(release?.notes).toBe('')
  })

  it('surfaces the body verbatim when present', async () => {
    const body = '## Highlights\nFixes #199.'
    netMock.fetch.mockResolvedValueOnce(jsonResponse([makeRelease({ body })]))

    const service = new FirmwareService()
    const [release] = await service.listReleases('beta')

    expect(release?.notes).toBe(body)
  })
})

describe('FirmwareService.listReleases — trusted URL allowlist (#880)', () => {
  it('trusts both binary URLs and their .sha256 sibling URLs after listReleases()', async () => {
    netMock.fetch.mockResolvedValueOnce(
      jsonResponse([
        makeRelease({
          tag_name: 'v0.7.1',
          assets: [fwAsset('0.7.1', 1_000), spiffsAsset('0.7.1', 500)],
        }),
      ])
    )

    const service = new FirmwareService()
    await service.listReleases('beta')

    // Both browser_download_urls + their .sha256 manifest siblings should pass.
    expect(service.isFirmwareUrlTrusted('https://example.test/fw-0.7.1.bin')).toBe(true)
    expect(service.isFirmwareUrlTrusted('https://example.test/fw-0.7.1.bin.sha256')).toBe(true)
    expect(service.isFirmwareUrlTrusted('https://example.test/spiffs-0.7.1.bin')).toBe(true)
    expect(service.isFirmwareUrlTrusted('https://example.test/spiffs-0.7.1.bin.sha256')).toBe(true)
  })

  it('refuses URLs that were never surfaced by a verified listReleases()', () => {
    const service = new FirmwareService()
    expect(service.isFirmwareUrlTrusted('https://example.test/never-seen.bin')).toBe(false)
    expect(
      service.isFirmwareUrlTrusted('https://objects.githubusercontent.com/foreign/asset.bin')
    ).toBe(false)
  })

  it('accumulates URLs across multiple listReleases() calls (channel switch)', async () => {
    netMock.fetch.mockResolvedValueOnce(
      jsonResponse([makeRelease({ tag_name: 'v0.7.1', assets: [fwAsset('0.7.1', 1_000)] })])
    )
    netMock.fetch.mockResolvedValueOnce(
      jsonResponse([
        makeRelease({ tag_name: 'v0.8.0-beta', assets: [fwAsset('0.8.0-beta', 1_000)] }),
      ])
    )

    const service = new FirmwareService()
    await service.listReleases('stable')
    await service.listReleases('beta')

    expect(service.isFirmwareUrlTrusted('https://example.test/fw-0.7.1.bin')).toBe(true)
    expect(service.isFirmwareUrlTrusted('https://example.test/fw-0.8.0-beta.bin')).toBe(true)
  })
})

describe('FirmwareService.listReleases — malformed payload tolerance', () => {
  it('skips releases that fail the type guard without throwing', async () => {
    netMock.fetch.mockResolvedValueOnce(
      jsonResponse([
        makeRelease({ tag_name: 'v0.7.1' }),
        // Missing tag_name — must be skipped, not crashing the run.
        { prerelease: false, published_at: '2026-01-01T00:00:00Z', assets: [] },
        // tag_name is a number, not a string — also skipped.
        { tag_name: 42, prerelease: false, published_at: 'x', assets: [] },
        null,
        'not an object',
      ])
    )

    const service = new FirmwareService()
    const releases = await service.listReleases('beta')

    expect(releases).toHaveLength(1)
    expect(releases[0]?.version).toBe('0.7.1')
  })

  it('skips assets that fail the asset type guard', async () => {
    netMock.fetch.mockResolvedValueOnce(
      jsonResponse([
        makeRelease({
          assets: [
            // Valid firmware asset — kept.
            fwAsset('0.7.1', 1_000),
            // Missing size field — dropped.
            {
              name: 'canshift-firmware-broken-crowpanel_28-merged.bin',
              browser_download_url: 'https://example.test/broken.bin',
            },
            // Wrong shape — dropped.
            null,
          ],
        }),
      ])
    )

    const service = new FirmwareService()
    const [release] = await service.listReleases('beta')

    // The valid firmware asset matched first — payloadBytes = 1000.
    expect(release?.payloadBytes).toBe(1_000)
    expect(release?.downloadUrl).toBe('https://example.test/fw-0.7.1.bin')
  })

  it('throws when the GitHub API returns a non-2xx response', async () => {
    netMock.fetch.mockResolvedValueOnce(jsonResponse(null, { ok: false, status: 502 }))

    const service = new FirmwareService()
    await expect(service.listReleases('stable')).rejects.toThrow(/GitHub API returned 502/)
  })

  it('propagates a network rejection', async () => {
    netMock.fetch.mockRejectedValueOnce(new Error('ENOTFOUND'))

    const service = new FirmwareService()
    await expect(service.listReleases('stable')).rejects.toThrow('ENOTFOUND')
  })
})

describe('FirmwareService.flashPort bookkeeping', () => {
  it('round-trips a path through setFlashPort / getFlashPort', () => {
    const service = new FirmwareService()
    expect(service.getFlashPort()).toBeNull()

    service.setFlashPort('/dev/tty.usbserial')
    expect(service.getFlashPort()).toBe('/dev/tty.usbserial')

    service.setFlashPort(null)
    expect(service.getFlashPort()).toBeNull()
  })
})

describe('FirmwareService.resetIntoBootloader — two-pass classic reset (#482)', () => {
  beforeEach(() => {
    serialRecorder.reset()
    vi.useFakeTimers({ toFake: ['setTimeout'] })
  })

  // Helper: run resetIntoBootloader against the recorder while flushing every
  // microtask + scheduled timer. The reset sequence interleaves callback
  // microtasks (port.set / port.close acks) with setTimeout waits — a naive
  // `runAllTimersAsync` only flushes one wave. Loop until the promise settles.
  async function runReset(
    service: FirmwareService,
    portPath: string
  ): Promise<{ success: boolean; error?: string }> {
    const settled = { done: false }
    const promise = service.resetIntoBootloader(portPath)
    const tracked = promise.then(
      (v) => {
        settled.done = true
        return v
      },
      (e: unknown) => {
        settled.done = true
        throw e instanceof Error ? e : new Error(String(e))
      }
    )
    // Bound the loop — 50 iterations is plenty for two passes (3 set + 1
    // close + 1 inter-pass sleep × 2 = ~12 waves).
    for (let i = 0; i < 50 && !settled.done; i += 1) {
      await vi.advanceTimersByTimeAsync(500)
    }
    return tracked
  }

  it('runs the classic sequence twice in order on a healthy port', async () => {
    const service = new FirmwareService()
    const result = await runReset(service, '/dev/tty.usbserial')

    expect(result).toEqual({ success: true })

    // Expected per pass: open, set(D0R1), set(D1R0), set(D0R0), close.
    // Two passes back-to-back → 10 entries total.
    const calls = serialRecorder.calls
    expect(calls).toEqual([
      { kind: 'open' },
      { kind: 'set', signals: { dtr: false, rts: true } },
      { kind: 'set', signals: { dtr: true, rts: false } },
      { kind: 'set', signals: { dtr: false, rts: false } },
      { kind: 'close' },
      { kind: 'open' },
      { kind: 'set', signals: { dtr: false, rts: true } },
      { kind: 'set', signals: { dtr: true, rts: false } },
      { kind: 'set', signals: { dtr: false, rts: false } },
      { kind: 'close' },
    ])
  })

  it('returns success with a 2nd-pass-failed caveat when set() rejects on the second pass', async () => {
    // Fail the very first set() of pass 2 (instance index 2).
    serialRecorder.injectFailure(2, 'set', new Error('EBUSY on second pass'))
    const service = new FirmwareService()

    const result = await runReset(service, '/dev/tty.usbserial')

    expect(result.success).toBe(true)
    expect(result.error).toMatch(/2nd pass failed/)
    expect(result.error).toMatch(/EBUSY on second pass/)
  })

  it('returns failure when the first-pass open() fails — no second pass attempted', async () => {
    serialRecorder.injectFailure(1, 'open', new Error('ENOENT'))
    const service = new FirmwareService()

    const result = await runReset(service, '/dev/tty.usbserial')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Open \/dev\/tty\.usbserial failed/)
    expect(result.error).toMatch(/ENOENT/)

    // Only one open() call — second pass must not have run.
    const opens = serialRecorder.calls.filter((c) => c.kind === 'open')
    expect(opens).toHaveLength(1)
  })

  it('still calls close() on a best-effort basis when set() throws on the first pass', async () => {
    serialRecorder.injectFailure(1, 'set', new Error('IOCTL failed'))
    const service = new FirmwareService()

    const result = await runReset(service, '/dev/tty.usbserial')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/IOCTL failed/)

    // Pass 1: open, set (failed), close (best-effort cleanup).
    // Pass 2 must not have started.
    const calls = serialRecorder.calls
    expect(calls[0]).toEqual({ kind: 'open' })
    expect(calls[1]).toEqual({ kind: 'set', signals: { dtr: false, rts: true } })
    expect(calls.some((c) => c.kind === 'close')).toBe(true)
    const opens = calls.filter((c) => c.kind === 'open')
    expect(opens).toHaveLength(1)
  })
})

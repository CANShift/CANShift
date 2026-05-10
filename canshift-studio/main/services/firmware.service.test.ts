// firmware.service.test.ts — coverage for the GitHub releases parser, the
// stable/beta channel filter, and the payloadBytes plumbing landed in #304.
//
// listReleases is the only piece of the FirmwareService that has shape risk:
// untrusted JSON from GitHub flows directly into the renderer, and the type
// guards are the only thing standing between a malformed release and a crash.
//
// @vitest-environment node

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const netMock = vi.hoisted(() => ({
  fetch: vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(),
}))

// Hoisted block — vi.mock factories run before module-level imports, so the
// stub class must live where they can reach it. The fake captures every
// set()/open()/close() call with its callback so tests can assert on the
// exact DTR/RTS sequence and timing emitted by resetIntoBootloader().
const stubs = vi.hoisted(() => {
  interface SetCall {
    signals: { dtr: boolean; rts: boolean }
    /** Time at which set() was invoked, relative to the test's vi.useFakeTimers() now(). */
    invokedAt: number
  }

  interface OpenScript {
    /** If set, callback is invoked with this error instead of success. */
    openError?: Error
    /** If set, the Nth call to set() (0-indexed) fails with this error. */
    setErrorAtCall?: { index: number; error: Error }
    /** If true, the close() call after success returns this error. */
    closeError?: Error
    /** If true, the close() call during failure cleanup returns this error (still swallowed). */
    cleanupCloseError?: Error
  }

  // Module-scoped script the FakeSerialPort constructor reads at instantiation.
  // Reset between tests via resetScript().
  let nextScript: OpenScript = {}
  const setScript = (s: OpenScript): void => {
    nextScript = s
  }
  const resetScript = (): void => {
    nextScript = {}
  }

  class FakeSerialPort {
    static instances: FakeSerialPort[] = []
    readonly path: string
    readonly setCalls: SetCall[] = []
    closed = false
    closeCallCount = 0
    private readonly script: OpenScript

    constructor(opts: { path: string; baudRate: number; autoOpen: boolean }) {
      this.path = opts.path
      this.script = nextScript
      FakeSerialPort.instances.push(this)
    }

    open(cb: (err?: Error | null) => void): void {
      // Mirror real SerialPort: callback runs on next tick, never sync.
      setTimeout(() => {
        cb(this.script.openError ?? null)
      }, 0)
    }

    set(signals: { dtr: boolean; rts: boolean }, cb: (err?: Error | null) => void): void {
      const callIndex = this.setCalls.length
      this.setCalls.push({ signals, invokedAt: Date.now() })
      const failure = this.script.setErrorAtCall
      setTimeout(() => {
        if (failure?.index === callIndex) {
          cb(failure.error)
          return
        }
        cb(null)
      }, 0)
    }

    close(cb?: (err?: Error | null) => void): void {
      this.closeCallCount += 1
      this.closed = true
      // The first close() after a successful sequence is the "real" close.
      // Subsequent ones (e.g. fail() cleanup after a set error) are swallowed.
      const useCloseErr = this.closeCallCount === 1
      setTimeout(() => {
        cb?.(
          useCloseErr ? (this.script.closeError ?? null) : (this.script.cleanupCloseError ?? null)
        )
      }, 0)
    }
  }

  return { FakeSerialPort, setScript, resetScript }
})

vi.mock('electron', () => ({ net: netMock }))
vi.mock('serialport', () => ({ SerialPort: stubs.FakeSerialPort }))

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
  stubs.FakeSerialPort.instances.length = 0
  stubs.resetScript()
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

// ---------------------------------------------------------------------------
// resetIntoBootloader — DTR/RTS sequence + timing (#482)
//
// Locks the auto-program circuit contract: the renderer relies on this
// function to land the chip in the ROM bootloader without a BOOT button
// press. The latch hold MUST be ≥ 250 ms or CrowPanel CH340 boards fall
// back to the manual-press flow.
// ---------------------------------------------------------------------------

const PORT_PATH = '/dev/tty.usbserial-test'
const EXPECTED_BOOT_PIN_PULL_MS = 100
const EXPECTED_BOOT_LATCH_MS = 250

describe('FirmwareService.resetIntoBootloader — DTR/RTS sequence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Drive the macrotask queue forward by `ms` ms. Used to step through the
  // setTimeout chain inside runClassicResetSequence without blocking on
  // real wall-clock time.
  const advance = async (ms: number): Promise<void> => {
    await vi.advanceTimersByTimeAsync(ms)
  }

  it('emits the exact 3-step DTR/RTS sequence with #482 timings', async () => {
    const service = new FirmwareService()
    const promise = service.resetIntoBootloader(PORT_PATH)

    // Run the full timer chain (open → 3× set → close).
    await vi.runAllTimersAsync()
    const port = stubs.FakeSerialPort.instances[0]
    expect(port).toBeDefined()
    if (!port) throw new Error('port not constructed')
    expect(port.path).toBe(PORT_PATH)

    expect(port.setCalls).toHaveLength(3)
    expect(port.setCalls[0]?.signals).toEqual({ dtr: false, rts: true })
    expect(port.setCalls[1]?.signals).toEqual({ dtr: true, rts: false })
    expect(port.setCalls[2]?.signals).toEqual({ dtr: false, rts: false })

    const result = await promise
    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
    expect(port.closed).toBe(true)
  })

  it('holds BOOT_PIN_PULL_MS between step 1 and step 2', async () => {
    const service = new FirmwareService()
    const promise = service.resetIntoBootloader(PORT_PATH)

    // Flush open() and the first set() callback (each is setTimeout(_, 0)).
    await vi.runOnlyPendingTimersAsync() // open() cb fires → calls set #1
    await vi.runOnlyPendingTimersAsync() // set #1 cb fires → queues BOOT_PIN_PULL_MS timer
    const port = stubs.FakeSerialPort.instances[0]
    if (!port) throw new Error('port not constructed')
    expect(port.setCalls).toHaveLength(1)

    // Just under the hold — must NOT have fired the second toggle yet.
    await advance(EXPECTED_BOOT_PIN_PULL_MS - 1)
    expect(port.setCalls).toHaveLength(1)

    // Cross the threshold — fires the BOOT_PIN_PULL_MS timer which calls set #2.
    await vi.runOnlyPendingTimersAsync()
    expect(port.setCalls).toHaveLength(2)

    await vi.runAllTimersAsync()
    await promise
  })

  it('holds BOOT_LATCH_MS = 250 ms between step 2 and step 3 (was 50 ms before #482)', async () => {
    const service = new FirmwareService()
    const promise = service.resetIntoBootloader(PORT_PATH)

    // Drive forward to just after step 2 has been recorded:
    // open → set #1 → set #1 cb → BOOT_PIN_PULL_MS timer → set #2 → set #2 cb.
    await vi.runOnlyPendingTimersAsync() // open() cb
    await vi.runOnlyPendingTimersAsync() // set #1 cb (queues BOOT_PIN_PULL_MS timer)
    await vi.runOnlyPendingTimersAsync() // BOOT_PIN_PULL_MS timer fires → calls set #2
    await vi.runOnlyPendingTimersAsync() // set #2 cb (queues BOOT_LATCH_MS timer)
    const port = stubs.FakeSerialPort.instances[0]
    if (!port) throw new Error('port not constructed')
    expect(port.setCalls).toHaveLength(2)

    // Bumping by 50 ms (the OLD latch hold) must NOT advance to step 3.
    // This is the regression check that guarantees we won't silently
    // revert to the old value.
    await advance(50)
    expect(port.setCalls).toHaveLength(2)

    // Bump up to just under the new hold — still no step 3.
    await advance(EXPECTED_BOOT_LATCH_MS - 50 - 1)
    expect(port.setCalls).toHaveLength(2)

    // Finish the latch hold — step 3 must now fire.
    await vi.runOnlyPendingTimersAsync()
    expect(port.setCalls).toHaveLength(3)
    expect(port.setCalls[2]?.signals).toEqual({ dtr: false, rts: false })

    await vi.runAllTimersAsync()
    await promise
  })

  it('closes the port before resolving on success', async () => {
    const service = new FirmwareService()
    const promise = service.resetIntoBootloader(PORT_PATH)

    await vi.runAllTimersAsync()
    const port = stubs.FakeSerialPort.instances[0]
    if (!port) throw new Error('port not constructed')
    const result = await promise

    expect(result.success).toBe(true)
    expect(port.closeCallCount).toBe(1)
    expect(port.closed).toBe(true)
  })

  it('returns failure with error message when open() fails', async () => {
    stubs.setScript({ openError: new Error('EBUSY: port already open') })
    const service = new FirmwareService()
    const promise = service.resetIntoBootloader(PORT_PATH)

    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.success).toBe(false)
    expect(result.error).toContain(PORT_PATH)
    expect(result.error).toContain('EBUSY')
    // No DTR/RTS toggles attempted when open fails.
    const port = stubs.FakeSerialPort.instances[0]
    expect(port?.setCalls).toHaveLength(0)
  })

  it('returns failure and attempts cleanup close when set() fails mid-sequence', async () => {
    stubs.setScript({ setErrorAtCall: { index: 1, error: new Error('EIO: signal write failed') } })
    const service = new FirmwareService()
    const promise = service.resetIntoBootloader(PORT_PATH)

    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.success).toBe(false)
    expect(result.error).toBe('EIO: signal write failed')

    const port = stubs.FakeSerialPort.instances[0]
    if (!port) throw new Error('port not constructed')
    // First two set() attempts ran (the second one is the failing call).
    expect(port.setCalls).toHaveLength(2)
    // Cleanup close was attempted exactly once.
    expect(port.closeCallCount).toBe(1)
  })

  it('still surfaces success (with caveat) when close() errors after a clean sequence', async () => {
    stubs.setScript({ closeError: new Error('EBADF: bad file descriptor') })
    const service = new FirmwareService()
    const promise = service.resetIntoBootloader(PORT_PATH)

    await vi.runAllTimersAsync()
    const result = await promise

    // Existing convention (preserved by the refactor): close error after a
    // good reset reports success: true with the close error as caveat.
    expect(result.success).toBe(true)
    expect(result.error).toContain('close')
    expect(result.error).toContain('EBADF')
  })
})

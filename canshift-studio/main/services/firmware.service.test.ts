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

// Hoisted block — vi.mock factories run before module-level imports, so the
// stub class must live where they can reach it.
const stubs = vi.hoisted(() => {
  class SerialPortStub {
    readonly _stub = true
  }
  return { SerialPortStub }
})

vi.mock('electron', () => ({ net: netMock }))
vi.mock('serialport', () => ({ SerialPort: stubs.SerialPortStub }))

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

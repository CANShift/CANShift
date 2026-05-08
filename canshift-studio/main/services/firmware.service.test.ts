// firmware.service.test.ts — coverage for GitHub release parsing and the
// CORS-bypass binary download path (issue #219). resetIntoBootloader is
// deliberately out of scope: it drives DTR/RTS timing on a real serial port
// and is exercised end-to-end during firmware flashing — mocking it here would
// only assert the test's own copy of the timing logic.
//
// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest'

const electronMock = vi.hoisted(() => ({
  net: {
    fetch: vi.fn(),
  },
}))
vi.mock('electron', () => electronMock)

vi.mock('serialport', () => ({
  // Tests here never invoke resetIntoBootloader, so a stub constructor with no
  // members is enough to satisfy the `new SerialPort(...)` import-time check.
  SerialPort: class FakeSerialPort {
    readonly path = ''
  },
}))

import { FirmwareService } from './firmware.service'

beforeEach(() => {
  electronMock.net.fetch.mockReset()
})

interface GhAsset {
  name: string
  browser_download_url: string
  size: number
}
interface GhRelease {
  tag_name: string
  prerelease: boolean
  published_at: string
  body: string | null
  assets: GhAsset[]
}

function fwAsset(version: string): GhAsset {
  return {
    name: `canshift-firmware-${version}-crowpanel_28-merged.bin`,
    browser_download_url: `https://example/fw-${version}.bin`,
    size: 1234,
  }
}

function spiffsAsset(version: string): GhAsset {
  return {
    name: `canshift-spiffs-${version}-crowpanel_28.bin`,
    browser_download_url: `https://example/spiffs-${version}.bin`,
    size: 999,
  }
}

function fakeFetchOk(payload: unknown): void {
  electronMock.net.fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(payload),
  })
}

describe('FirmwareService.flashPort getter/setter', () => {
  it('starts as null', () => {
    const service = new FirmwareService()
    expect(service.getFlashPort()).toBeNull()
  })

  it('round-trips a path through setFlashPort', () => {
    const service = new FirmwareService()
    service.setFlashPort('/dev/tty.usbserial-XYZ')
    expect(service.getFlashPort()).toBe('/dev/tty.usbserial-XYZ')
  })

  it('clears the path when set to null', () => {
    const service = new FirmwareService()
    service.setFlashPort('/dev/tty.test')
    service.setFlashPort(null)
    expect(service.getFlashPort()).toBeNull()
  })
})

describe('FirmwareService.listReleases', () => {
  it('throws when GitHub responds non-2xx', async () => {
    electronMock.net.fetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: vi.fn(),
    })
    const service = new FirmwareService()
    await expect(service.listReleases('stable')).rejects.toThrow('GitHub API returned 503')
  })

  it('skips items missing required fields (isRelease guard)', async () => {
    fakeFetchOk([
      { tag_name: 'v0.7.0' }, // missing prerelease/published_at/assets
      null,
      'not an object',
      {
        tag_name: 'v0.7.1',
        prerelease: false,
        published_at: '2026-01-01T00:00:00Z',
        body: null,
        assets: [fwAsset('0.7.1')],
      },
    ])
    const service = new FirmwareService()
    const releases = await service.listReleases('stable')
    expect(releases).toHaveLength(1)
    expect(releases[0]?.version).toBe('0.7.1')
  })

  it('strips a leading "v" from the tag for the version field', async () => {
    fakeFetchOk([
      {
        tag_name: 'v1.2.3',
        prerelease: false,
        published_at: '2026-01-01T00:00:00Z',
        body: null,
        assets: [fwAsset('1.2.3')],
      },
      {
        tag_name: '2.0.0', // no leading v — should round-trip unchanged
        prerelease: false,
        published_at: '2026-01-02T00:00:00Z',
        body: null,
        assets: [fwAsset('2.0.0')],
      },
    ])
    const service = new FirmwareService()
    const releases = await service.listReleases('stable')
    expect(releases[0]?.version).toBe('1.2.3')
    expect(releases[1]?.version).toBe('2.0.0')
  })

  it('filters out prereleases on the stable channel', async () => {
    const releases: GhRelease[] = [
      {
        tag_name: 'v1.0.0',
        prerelease: false,
        published_at: '2026-01-01T00:00:00Z',
        body: '',
        assets: [fwAsset('1.0.0')],
      },
      {
        tag_name: 'v1.1.0-beta',
        prerelease: true,
        published_at: '2026-01-02T00:00:00Z',
        body: '',
        assets: [fwAsset('1.1.0-beta')],
      },
    ]
    fakeFetchOk(releases)
    const service = new FirmwareService()
    const result = await service.listReleases('stable')
    expect(result).toHaveLength(1)
    expect(result[0]?.tag).toBe('v1.0.0')
  })

  it('includes prereleases on the beta channel', async () => {
    const releases: GhRelease[] = [
      {
        tag_name: 'v1.0.0',
        prerelease: false,
        published_at: '2026-01-01T00:00:00Z',
        body: '',
        assets: [fwAsset('1.0.0')],
      },
      {
        tag_name: 'v1.1.0-beta',
        prerelease: true,
        published_at: '2026-01-02T00:00:00Z',
        body: '',
        assets: [fwAsset('1.1.0-beta')],
      },
    ]
    fakeFetchOk(releases)
    const service = new FirmwareService()
    const result = await service.listReleases('beta')
    expect(result).toHaveLength(2)
  })

  it('extracts firmware + spiffs URLs separately', async () => {
    fakeFetchOk([
      {
        tag_name: 'v0.7.1',
        prerelease: false,
        published_at: '2026-01-01T00:00:00Z',
        body: '',
        assets: [fwAsset('0.7.1'), spiffsAsset('0.7.1')],
      },
    ])
    const service = new FirmwareService()
    const releases = await service.listReleases('stable')
    expect(releases[0]?.downloadUrl).toBe('https://example/fw-0.7.1.bin')
    expect(releases[0]?.spiffsUrl).toBe('https://example/spiffs-0.7.1.bin')
    expect(releases[0]?.payloadBytes).toBe(1234)
  })

  it('omits download fields when no firmware asset is attached', async () => {
    fakeFetchOk([
      {
        tag_name: 'v0.7.1',
        prerelease: false,
        published_at: '2026-01-01T00:00:00Z',
        body: '',
        assets: [], // empty — release exists but has no binaries yet
      },
    ])
    const service = new FirmwareService()
    const releases = await service.listReleases('stable')
    expect(releases[0]?.downloadUrl).toBeUndefined()
    expect(releases[0]?.spiffsUrl).toBeUndefined()
    expect(releases[0]?.payloadBytes).toBeUndefined()
  })

  it('coerces a null release body to an empty string', async () => {
    fakeFetchOk([
      {
        tag_name: 'v0.7.1',
        prerelease: false,
        published_at: '2026-01-01T00:00:00Z',
        body: null,
        assets: [fwAsset('0.7.1')],
      },
    ])
    const service = new FirmwareService()
    const releases = await service.listReleases('stable')
    expect(releases[0]?.notes).toBe('')
  })
})

describe('FirmwareService.downloadBinary', () => {
  function fakeBodyStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk)
        controller.close()
      },
    })
  }

  it('throws when the response is not ok', async () => {
    electronMock.net.fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Map(),
      body: null,
    })
    const service = new FirmwareService()
    await expect(service.downloadBinary('https://x', vi.fn())).rejects.toThrow('HTTP 404')
  })

  it('throws when the response has no body', async () => {
    electronMock.net.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['content-length', '0']]),
      body: null,
    })
    const service = new FirmwareService()
    await expect(service.downloadBinary('https://x', vi.fn())).rejects.toThrow('No response body')
  })

  it('streams chunks, reports progress, and concatenates the buffer', async () => {
    const chunkA = new Uint8Array([1, 2, 3])
    const chunkB = new Uint8Array([4, 5])
    electronMock.net.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['content-length', '5']]),
      body: fakeBodyStream([chunkA, chunkB]),
    })

    const onProgress = vi.fn()
    const service = new FirmwareService()
    const buf = await service.downloadBinary('https://x', onProgress)

    expect(new Uint8Array(buf)).toEqual(new Uint8Array([1, 2, 3, 4, 5]))
    expect(onProgress).toHaveBeenNthCalledWith(1, 3, 5)
    expect(onProgress).toHaveBeenNthCalledWith(2, 5, 5)
  })

  it('reports total=0 when content-length header is missing', async () => {
    electronMock.net.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map(), // no content-length
      body: fakeBodyStream([new Uint8Array([1, 2])]),
    })

    const onProgress = vi.fn()
    const service = new FirmwareService()
    await service.downloadBinary('https://x', onProgress)

    expect(onProgress).toHaveBeenCalledWith(2, 0)
  })
})

import type { ReleaseAsset, ReleaseInfo } from '@tmbk/canshift-core'
import type { FirmwareRelease } from '../services/ota.service'
import { releasesService } from '../services/releases.service'
import { loadOtaReleases, resetOtaReleasesStore, useOtaReleasesStore } from './ota-releases.store'

jest.mock('../services/releases.service', () => ({
  releasesService: {
    getAllReleases: jest.fn(),
  },
}))

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockedGetAll = releasesService.getAllReleases as jest.MockedFunction<
  typeof releasesService.getAllReleases
>

const asset = (name: string): ReleaseAsset => {
  return {
    name,
    downloadUrl: 'https://x',
    sizeBytes: 1,
  }
}

const releaseInfo = (version: string, opts?: { assets?: ReleaseAsset[] }): ReleaseInfo => {
  return {
    version,
    tag: `v${version}`,
    name: `Release v${version}`,
    notes: '',
    publishedAt: '2026-01-01T00:00:00Z',
    prerelease: false,
    htmlUrl: `https://github.com/x/y/releases/tag/v${version}`,
    assets: opts?.assets ?? [asset(`canshift-${version}-firmware.bin`)],
  }
}

const expectedFirmware = (version: string): FirmwareRelease => {
  return {
    version,
    publishedAt: '2026-01-01T00:00:00Z',
    notes: '',
    downloadUrl: 'https://x',
    sizeBytes: 1,
    sha256: null,
  }
}

const okResult = (releases: ReleaseInfo[]) => {
  return {
    ok: true as const,
    releases,
    fetchedAt: '2026-06-02T00:00:00Z',
    fromCache: false,
  }
}

describe('ota-releases.store', () => {
  beforeEach(() => {
    resetOtaReleasesStore()
    mockedGetAll.mockReset()
  })

  it('starts empty, not loading, no error', () => {
    const state = useOtaReleasesStore.getState()
    expect(state.releases).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.loadCount).toBe(0)
  })

  describe('loadOtaReleases', () => {
    it('flips loading during the call and lands the mapped releases on success', async () => {
      mockedGetAll.mockResolvedValueOnce(okResult([releaseInfo('0.8.0'), releaseInfo('0.8.1')]))

      const promise = loadOtaReleases()
      expect(useOtaReleasesStore.getState().loading).toBe(true)

      await promise
      const state = useOtaReleasesStore.getState()
      expect(state.loading).toBe(false)
      expect(state.releases).toEqual([expectedFirmware('0.8.0'), expectedFirmware('0.8.1')])
      expect(state.error).toBeNull()
      expect(state.loadCount).toBe(1)
    })

    it('drops releases that have no OTA-flashable asset', async () => {
      mockedGetAll.mockResolvedValueOnce(
        okResult([
          releaseInfo('1.0.0', { assets: [asset('canshift-1.0.0-merged.bin')] }),
          releaseInfo('1.0.1'),
        ])
      )
      await loadOtaReleases()
      const state = useOtaReleasesStore.getState()
      expect(state.releases).toEqual([expectedFirmware('1.0.1')])
    })

    it('threads the SHA-256 digest from the asset when present', async () => {
      const digest = 'a'.repeat(64)
      mockedGetAll.mockResolvedValueOnce(
        okResult([
          releaseInfo('1.0.0', {
            assets: [{ ...asset('canshift-1.0.0-firmware.bin'), digest: `sha256:${digest}` }],
          }),
        ])
      )
      await loadOtaReleases()
      expect(useOtaReleasesStore.getState().releases[0]?.sha256).toBe(digest)
    })

    it('surfaces the failure message when the service returns ok=false', async () => {
      mockedGetAll.mockResolvedValueOnce({
        ok: false,
        reason: 'offline',
        message: 'network down',
        fetchedAt: '2026-06-02T00:00:00Z',
        cachedReleases: null,
      })
      await loadOtaReleases()
      const state = useOtaReleasesStore.getState()
      expect(state.loading).toBe(false)
      expect(state.error).toBe('network down')
      expect(state.releases).toEqual([])
    })

    it('clears a previous error on a fresh load attempt', async () => {
      mockedGetAll.mockResolvedValueOnce({
        ok: false,
        reason: 'offline',
        message: 'boom',
        fetchedAt: '2026-06-02T00:00:00Z',
        cachedReleases: null,
      })
      await loadOtaReleases()
      expect(useOtaReleasesStore.getState().error).toBe('boom')

      mockedGetAll.mockResolvedValueOnce(okResult([releaseInfo('1.0.0')]))
      await loadOtaReleases()
      const state = useOtaReleasesStore.getState()
      expect(state.error).toBeNull()
      expect(state.releases).toEqual([expectedFirmware('1.0.0')])
    })

    it('coalesces concurrent calls — second caller awaits the first', async () => {
      let resolveFirst: (
        v: Awaited<ReturnType<typeof releasesService.getAllReleases>>
      ) => void = () => undefined
      mockedGetAll.mockReturnValueOnce(
        new Promise((r) => {
          resolveFirst = r
        })
      )

      const first = loadOtaReleases()
      const second = loadOtaReleases()
      expect(useOtaReleasesStore.getState().loadCount).toBe(1)
      expect(mockedGetAll).toHaveBeenCalledTimes(1)

      resolveFirst(okResult([releaseInfo('1.0.0')]))
      await Promise.all([first, second])
      expect(mockedGetAll).toHaveBeenCalledTimes(1)
    })

    it('captures the thrown error when the service rejects unexpectedly', async () => {
      mockedGetAll.mockRejectedValueOnce(new Error('network down'))
      await loadOtaReleases()
      const state = useOtaReleasesStore.getState()
      expect(state.loading).toBe(false)
      expect(state.error).toBe('network down')
      expect(state.releases).toEqual([])
    })

    it('falls back to a generic message when the rejection is not an Error', async () => {
      mockedGetAll.mockRejectedValueOnce('weird thing')
      await loadOtaReleases()
      expect(useOtaReleasesStore.getState().error).toBe('Failed to load releases')
    })
  })
})

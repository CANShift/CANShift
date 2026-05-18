// ota-releases.store.test.ts — Coverage for the firmware-release store
// from #905. Underlying OtaService is mocked so this is pure-logic.

import type { FirmwareRelease } from '../services/ota.service'
import * as OtaService from '../services/ota.service'
import { loadOtaReleases, resetOtaReleasesStore, useOtaReleasesStore } from './ota-releases.store'

jest.mock('../services/ota.service', () => ({
  fetchReleases: jest.fn(),
}))

const mockedFetch = OtaService.fetchReleases as jest.MockedFunction<typeof OtaService.fetchReleases>

const release = (version: string): FirmwareRelease => ({
  version,
  publishedAt: '2026-01-01T00:00:00Z',
  notes: '',
  downloadUrl: 'https://x',
  sizeBytes: 1,
})

describe('ota-releases.store', () => {
  beforeEach(() => {
    resetOtaReleasesStore()
    mockedFetch.mockReset()
  })

  it('starts empty, not loading, no error', () => {
    const state = useOtaReleasesStore.getState()
    expect(state.releases).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.loadCount).toBe(0)
  })

  describe('loadOtaReleases', () => {
    it('flips loading during the call and lands the releases on success', async () => {
      const list = [release('0.8.0'), release('0.8.1')]
      mockedFetch.mockResolvedValueOnce(list)

      const promise = loadOtaReleases()
      expect(useOtaReleasesStore.getState().loading).toBe(true)

      await promise
      const state = useOtaReleasesStore.getState()
      expect(state.loading).toBe(false)
      expect(state.releases).toEqual(list)
      expect(state.error).toBeNull()
      expect(state.loadCount).toBe(1)
    })

    it('clears a previous error on a fresh load attempt', async () => {
      mockedFetch.mockRejectedValueOnce(new Error('boom'))
      await loadOtaReleases()
      expect(useOtaReleasesStore.getState().error).toBe('boom')

      mockedFetch.mockResolvedValueOnce([release('1.0.0')])
      await loadOtaReleases()
      const state = useOtaReleasesStore.getState()
      expect(state.error).toBeNull()
      expect(state.releases).toEqual([release('1.0.0')])
    })

    it('coalesces concurrent calls — second caller awaits the first', async () => {
      let resolveFirst: (v: FirmwareRelease[]) => void = () => undefined
      mockedFetch.mockReturnValueOnce(
        new Promise<FirmwareRelease[]>((r) => {
          resolveFirst = r
        })
      )

      const first = loadOtaReleases()
      const second = loadOtaReleases()
      expect(useOtaReleasesStore.getState().loadCount).toBe(1)
      expect(mockedFetch).toHaveBeenCalledTimes(1)

      resolveFirst([release('1.0.0')])
      await Promise.all([first, second])
      expect(mockedFetch).toHaveBeenCalledTimes(1)
    })

    it('captures the error message on failure', async () => {
      mockedFetch.mockRejectedValueOnce(new Error('network down'))
      await loadOtaReleases()
      const state = useOtaReleasesStore.getState()
      expect(state.loading).toBe(false)
      expect(state.error).toBe('network down')
      expect(state.releases).toEqual([])
    })

    it('falls back to a generic message when the rejection is not an Error', async () => {
      mockedFetch.mockRejectedValueOnce('weird thing')
      await loadOtaReleases()
      expect(useOtaReleasesStore.getState().error).toBe('Failed to load releases')
    })
  })
})

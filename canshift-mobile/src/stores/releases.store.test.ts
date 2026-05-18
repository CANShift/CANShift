// releases.store.test.ts — Coverage for the releases Zustand store from
// #905. The underlying releasesService is mocked so this is pure-logic.

import type { LatestReleaseResult } from '@tmbk/canshift-core'
import { releasesService } from '../services/releases.service'
import { loadReleases, resetReleasesStore, useReleasesStore } from './releases.store'

jest.mock('../services/releases.service', () => ({
  releasesService: { getLatest: jest.fn() },
}))

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockedGetLatest = releasesService.getLatest as jest.MockedFunction<
  typeof releasesService.getLatest
>

const okResult = (overrides: Partial<LatestReleaseResult> = {}): LatestReleaseResult => ({
  ok: true,
  release: {
    version: '1.2.3',
    tag: 'v1.2.3',
    name: null,
    notes: '',
    publishedAt: '2026-01-01T00:00:00Z',
    prerelease: false,
    htmlUrl: 'https://example.com',
    assets: [],
  },
  prerelease: null,
  fetchedAt: '2026-01-01T00:00:00Z',
  fromCache: false,
  ...(overrides as Partial<LatestReleaseResult & { ok: true }>),
})

describe('releases.store', () => {
  beforeEach(() => {
    resetReleasesStore()
    mockedGetLatest.mockReset()
  })

  it('starts in loading state with no previous result', () => {
    const state = useReleasesStore.getState()
    expect(state.latest).toEqual({ status: 'loading', previous: null })
    expect(state.isFetching).toBe(false)
    expect(state.loadCount).toBe(0)
  })

  describe('loadReleases', () => {
    it('flips isFetching during the call and lands a ready result', async () => {
      mockedGetLatest.mockResolvedValueOnce(okResult())
      const promise = loadReleases(false)
      expect(useReleasesStore.getState().isFetching).toBe(true)
      await promise
      const state = useReleasesStore.getState()
      expect(state.isFetching).toBe(false)
      expect(state.latest.status).toBe('ready')
      expect(state.loadCount).toBe(1)
    })

    it('passes the force flag through to the service', async () => {
      mockedGetLatest.mockResolvedValueOnce(okResult())
      await loadReleases(true)
      expect(mockedGetLatest).toHaveBeenCalledWith(true)
    })

    it('preserves the prior ready result while a refresh is in-flight', async () => {
      mockedGetLatest.mockResolvedValueOnce(okResult())
      await loadReleases(false)
      const firstResult = (useReleasesStore.getState().latest as { result: LatestReleaseResult })
        .result

      mockedGetLatest.mockReturnValueOnce(new Promise(() => undefined)) // never resolves
      void loadReleases(true)
      const mid = useReleasesStore.getState().latest
      expect(mid.status).toBe('loading')
      expect((mid as { previous: LatestReleaseResult | null }).previous).toBe(firstResult)
    })

    it('coalesces concurrent calls — second caller awaits the first', async () => {
      let resolveFirst: (v: LatestReleaseResult) => void = () => undefined
      mockedGetLatest.mockReturnValueOnce(
        new Promise<LatestReleaseResult>((r) => {
          resolveFirst = r
        })
      )

      const first = loadReleases(false)
      const second = loadReleases(false)
      expect(useReleasesStore.getState().loadCount).toBe(1)
      expect(mockedGetLatest).toHaveBeenCalledTimes(1)

      resolveFirst(okResult())
      await Promise.all([first, second])
      expect(mockedGetLatest).toHaveBeenCalledTimes(1)
    })

    it('surfaces thrown errors as an offline-style ready result', async () => {
      mockedGetLatest.mockRejectedValueOnce(new Error('boom'))
      await loadReleases(false)
      const state = useReleasesStore.getState()
      expect(state.isFetching).toBe(false)
      expect(state.latest.status).toBe('ready')
      const result = (state.latest as { result: LatestReleaseResult }).result
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe('offline')
        expect(result.message).toBe('boom')
      }
    })
  })
})

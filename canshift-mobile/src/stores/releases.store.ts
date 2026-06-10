import { create } from 'zustand'
import type { LatestReleaseResult } from '@tmbk/canshift-core'
import { releasesService } from '../services/releases.service'

export type LatestReleaseStatus =
  | { status: 'loading'; previous: LatestReleaseResult | null }
  | { status: 'ready'; result: LatestReleaseResult }

interface ReleasesState {
  latest: LatestReleaseStatus
  isFetching: boolean
  loadCount: number
}

const initial: ReleasesState = {
  latest: { status: 'loading', previous: null },
  isFetching: false,
  loadCount: 0,
}

export const useReleasesStore = create<ReleasesState>(() => initial)

let inFlight: Promise<void> | null = null

export async function loadReleases(force: boolean): Promise<void> {
  if (inFlight) return inFlight

  useReleasesStore.setState((s) => ({
    latest:
      s.latest.status === 'ready' ? { status: 'loading', previous: s.latest.result } : s.latest,
    isFetching: true,
    loadCount: s.loadCount + 1,
  }))

  inFlight = (async () => {
    try {
      const result = await releasesService.getLatest(force)
      useReleasesStore.setState({
        latest: { status: 'ready', result },
        isFetching: false,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      useReleasesStore.setState({
        latest: {
          status: 'ready',
          result: {
            ok: false,
            reason: 'offline',
            message,
            fetchedAt: new Date().toISOString(),
            cached: null,
          },
        },
        isFetching: false,
      })
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}

export const resetReleasesStore = (): void => {
  inFlight = null
  useReleasesStore.setState(initial, true)
}

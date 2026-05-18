// releases.store.ts — Zustand store wrapping the latest-GitHub-release
// fetch (#905). Moves the data-fetching out of the useEffect-driven
// `use-latest-release` hook into a store action, matching the
// device/log/signals store pattern.
//
// State:
//   - status: 'loading' on first ever load (no previous), 'ready' otherwise
//   - lastResult: the most recent LatestReleaseResult (success or fail)
//   - isFetching: true while a load is in-flight, including silent refreshes
//
// The `loadReleases` action is idempotent in the sense that calling it
// while a load is already in-flight is a no-op (the in-flight promise is
// surfaced instead of starting a second concurrent fetch). The service
// itself caches in-memory; passing `force: true` bypasses that cache.

import { create } from 'zustand'
import type { LatestReleaseResult } from '@tmbk/canshift-core'
import { releasesService } from '../services/releases.service'

export type LatestReleaseStatus =
  | { status: 'loading'; previous: LatestReleaseResult | null }
  | { status: 'ready'; result: LatestReleaseResult }

interface ReleasesState {
  latest: LatestReleaseStatus
  isFetching: boolean
  /** Number of times `loadReleases()` has been invoked since boot. */
  loadCount: number
}

const initial: ReleasesState = {
  latest: { status: 'loading', previous: null },
  isFetching: false,
  loadCount: 0,
}

export const useReleasesStore = create<ReleasesState>(() => initial)

/** In-flight load promise — null when no fetch is currently running. */
let inFlight: Promise<void> | null = null

/**
 * Trigger a fetch. When `force` is true the service's in-memory cache is
 * bypassed; otherwise the cache may answer immediately. Coalesces
 * concurrent calls — the second caller during an in-flight load just
 * awaits the same promise.
 */
export async function loadReleases(force: boolean): Promise<void> {
  if (inFlight) return inFlight

  // Keep the previously known result visible while we refresh so callers
  // don't collapse back to a skeleton during the round-trip.
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
      // releasesService is engineered not to throw, but be defensive:
      // surface an offline-style result so the UI keeps a single render
      // path.
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

/** Reset the store back to its initial state — used by tests. */
export function resetReleasesStore(): void {
  inFlight = null
  useReleasesStore.setState(initial, true)
}

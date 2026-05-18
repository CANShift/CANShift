// use-latest-release.ts — React hook around the releases.store (#571 + #905).
//
// Pure selector over the Zustand store — the fetch lifecycle lives in
// `loadReleases` (releases.store.ts), not in this hook. The hook keeps a
// stable return shape so AboutScreen renders unchanged.

import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { LatestReleaseResult } from '@tmbk/canshift-core'
import { loadReleases, useReleasesStore, type LatestReleaseStatus } from '../stores/releases.store'

export type LatestReleaseState = LatestReleaseStatus

export interface UseLatestReleaseReturn {
  state: LatestReleaseState
  /** True while a fetch (initial or refresh) is in-flight. */
  isFetching: boolean
  /** Trigger a forced refetch — bypasses the in-memory cache. */
  refresh: () => void
}

export function useLatestRelease(): UseLatestReleaseReturn {
  const { latest, isFetching, loadCount } = useReleasesStore(
    useShallow((s) => ({
      latest: s.latest,
      isFetching: s.isFetching,
      loadCount: s.loadCount,
    }))
  )

  // Kick off the first load on mount when the store is untouched.
  // Subsequent mounts reuse whatever state the store has already produced.
  // Intentionally not depending on `loadCount` — we only check it once on
  // mount; re-running on increment would refetch on every page navigation.
  useEffect(() => {
    if (loadCount === 0) void loadReleases(false)
  }, [])

  const refresh = (): void => {
    void loadReleases(true)
  }

  return { state: latest, isFetching, refresh }
}

/** Bare access for callers that don't need the React lifecycle. */
export type { LatestReleaseResult }

// useLatestRelease.ts — Renderer-side selector around the releases store.
//
// Issue #571 introduced this hook; issue #905 moved the IPC + state transitions
// into `releases.store.ts` so we follow the studio rule "no useEffect for data
// fetching — use Zustand actions". This file is now a thin bridge: it selects
// from the store and kicks off the initial fetch on mount.

import { useCallback, useEffect } from 'react'
import { useReleasesStore, type LatestReleaseState } from '../stores/releases.store'

export type { LatestReleaseState }

export interface UseLatestReleaseReturn {
  state: LatestReleaseState
  /** True while a fetch (initial or refresh) is in-flight. */
  isFetching: boolean
  /** Trigger a forced refetch — bypasses the main-process cache. */
  refresh: () => void
}

export function useLatestRelease(): UseLatestReleaseReturn {
  const state = useReleasesStore((s) => s.state)
  const isFetching = useReleasesStore((s) => s.isFetching)
  const loadLatest = useReleasesStore((s) => s.loadLatest)
  const refreshAction = useReleasesStore((s) => s.refresh)

  // Idiomatic Zustand bridge — the side effect is in the store action; this
  // effect only schedules the first invocation when the consumer mounts.
  useEffect(() => {
    void loadLatest()
  }, [loadLatest])

  const refresh = useCallback((): void => {
    void refreshAction()
  }, [refreshAction])

  return { state, isFetching, refresh }
}

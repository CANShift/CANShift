// use-latest-release.ts — React hook around `releasesService.getLatest`.
//
// Issue #571 (mobile side). Mirrors the studio hook (`useLatestRelease.ts`)
// API surface so the on-screen card can share the same rendering path. The
// service does the actual caching; this hook only retains the latest result
// so the screen can render immediately on remount without flashing a
// loading state.

import { useCallback, useEffect, useRef, useState } from 'react'
import { releasesService } from '../services/releases.service'
import type { LatestReleaseResult } from '@tmbk/canshift-core'

export type LatestReleaseState =
  | { status: 'loading'; previous: LatestReleaseResult | null }
  | { status: 'ready'; result: LatestReleaseResult }

export interface UseLatestReleaseReturn {
  state: LatestReleaseState
  /** True while a fetch (initial or refresh) is in-flight. */
  isFetching: boolean
  /** Trigger a forced refetch — bypasses the in-memory cache. */
  refresh: () => void
}

export function useLatestRelease(): UseLatestReleaseReturn {
  const [state, setState] = useState<LatestReleaseState>({
    status: 'loading',
    previous: null,
  })
  const [isFetching, setIsFetching] = useState(true)
  // Strict-mode dev double-mount guard — keeps a late resolution from
  // overwriting a fresher one after unmount.
  const cancelledRef = useRef(false)

  const fetchOnce = useCallback(async (force: boolean): Promise<void> => {
    setIsFetching(true)
    try {
      const result = await releasesService.getLatest(force)
      if (cancelledRef.current) return
      setState({ status: 'ready', result })
    } catch (err) {
      if (cancelledRef.current) return
      // The service is engineered not to throw — but a bug or platform-level
      // failure could still surface here. Fall through to an offline-style
      // result so the screen keeps a single rendering path.
      const message = err instanceof Error ? err.message : 'Unknown error'
      setState({
        status: 'ready',
        result: {
          ok: false,
          reason: 'offline',
          message,
          fetchedAt: new Date().toISOString(),
          cached: null,
        },
      })
    } finally {
      if (!cancelledRef.current) setIsFetching(false)
    }
  }, [])

  useEffect(() => {
    cancelledRef.current = false
    void fetchOnce(false)
    return () => {
      cancelledRef.current = true
    }
  }, [fetchOnce])

  const refresh = useCallback((): void => {
    // Keep the previously known result visible while we refresh so the
    // screen doesn't collapse back to a skeleton during the round-trip.
    setState((prev) => {
      if (prev.status === 'ready') return { status: 'loading', previous: prev.result }
      return prev
    })
    void fetchOnce(true)
  }, [fetchOnce])

  return { state, isFetching, refresh }
}

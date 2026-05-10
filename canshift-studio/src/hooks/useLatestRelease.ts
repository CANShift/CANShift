// useLatestRelease.ts — Renderer-side hook around `releasesIpc.getLatest`.
//
// Issue #571: surface the current vs latest GitHub release in the studio. The
// hook keeps the loading / success / error state in one place so the card can
// stay declarative. The main-process service does the actual caching; this
// hook only retains the latest result it has seen so the component can render
// immediately on remount without flashing the loading skeleton.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { LatestReleaseResult } from '@tmbk/canshift-core'
import { releasesIpc } from '../services/ipc.service'

export type LatestReleaseState =
  | { status: 'loading'; previous: LatestReleaseResult | null }
  | { status: 'ready'; result: LatestReleaseResult }

export interface UseLatestReleaseReturn {
  state: LatestReleaseState
  /** True while a fetch (initial or refresh) is in-flight. */
  isFetching: boolean
  /** Trigger a forced refetch — bypasses the main-process cache. */
  refresh: () => void
}

export function useLatestRelease(): UseLatestReleaseReturn {
  const [state, setState] = useState<LatestReleaseState>({
    status: 'loading',
    previous: null,
  })
  const [isFetching, setIsFetching] = useState(true)
  // `Strict mode` mounts effects twice in dev — guard against the second pass
  // overwriting a result that has already landed.
  const cancelledRef = useRef(false)

  const fetchOnce = useCallback(async (force: boolean): Promise<void> => {
    setIsFetching(true)
    try {
      const result = await releasesIpc.getLatest(force)
      if (cancelledRef.current) return
      setState({ status: 'ready', result })
    } catch (err) {
      if (cancelledRef.current) return
      // The IPC bridge itself failed — this is distinct from the main-process
      // service surfacing a typed failure. Surface a minimal offline-style
      // result so the card can keep its single rendering path.
      const message = err instanceof Error ? err.message : 'IPC error'
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
    // Preserve the latest known result while we refresh so the card doesn't
    // collapse back to a skeleton during the round-trip.
    setState((prev) => {
      if (prev.status === 'ready') return { status: 'loading', previous: prev.result }
      return prev
    })
    void fetchOnce(true)
  }, [fetchOnce])

  return { state, isFetching, refresh }
}

// releases.store.ts — Latest GitHub release info (issue #905, #571).
//
// Centralises the lifecycle previously held in `useLatestRelease` local state.
// The hook now becomes a thin selector; all IPC traffic and state transitions
// live here so the rule "no useEffect for data fetching" is honoured.
//
// State machine mirrors what the card already renders:
//   - status: 'loading' + previous: LatestReleaseResult | null
//   - status: 'ready'   + result:   LatestReleaseResult
// `isFetching` is exposed separately so the "Check now" button can disable
// without forcing the card back to a skeleton during a forced refetch.

import { create } from 'zustand'
import type { LatestReleaseResult } from '@tmbk/canshift-core'
import { releasesIpc } from '../services/ipc.service'

export type LatestReleaseState =
  | { status: 'loading'; previous: LatestReleaseResult | null }
  | { status: 'ready'; result: LatestReleaseResult }

interface ReleasesState {
  state: LatestReleaseState
  /** True while a fetch (initial or refresh) is in-flight. */
  isFetching: boolean
  /** Kick off the initial fetch — idempotent once a fetch is in flight. */
  loadLatest: () => Promise<void>
  /** Force a refetch, bypassing the main-process cache. */
  refresh: () => Promise<void>
}

function ipcFailureResult(err: unknown): LatestReleaseResult {
  const message = err instanceof Error ? err.message : 'IPC error'
  return {
    ok: false,
    reason: 'offline',
    message,
    fetchedAt: new Date().toISOString(),
    cached: null,
  }
}

async function runFetch(
  set: (partial: Partial<ReleasesState>) => void,
  get: () => ReleasesState,
  force: boolean
): Promise<void> {
  if (get().isFetching) return
  set({ isFetching: true })
  try {
    const result = await releasesIpc.getLatest(force)
    set({ state: { status: 'ready', result }, isFetching: false })
  } catch (err) {
    // The IPC bridge itself failed — distinct from the main-process service
    // surfacing a typed failure. Surface a minimal offline-style result so
    // the card keeps a single rendering path.
    set({
      state: { status: 'ready', result: ipcFailureResult(err) },
      isFetching: false,
    })
  }
}

export const useReleasesStore = create<ReleasesState>()((set, get) => ({
  state: { status: 'loading', previous: null },
  isFetching: false,

  loadLatest: async () => {
    await runFetch(set, get, false)
  },

  refresh: async () => {
    // Preserve the latest known result while we refresh so the card doesn't
    // collapse back to a skeleton during the round-trip.
    const current = get().state
    if (current.status === 'ready') {
      set({ state: { status: 'loading', previous: current.result } })
    }
    await runFetch(set, get, true)
  },
}))

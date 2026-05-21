// appVersion.store.ts — Studio app version (issue #905).
//
// Resolves the running app version via `appIpc.version()` exactly once per
// session and caches it in the store. Four call sites previously duplicated
// the fetch inside `useEffect` (StatusBar, VersionMismatchBanner,
// ReleaseInfoCard, useCliRuntime). They now share a single Zustand-backed
// source of truth and avoid the "useEffect for data fetching" anti-pattern.

import { create } from 'zustand'
import { appIpc } from '../services/ipc.service'

interface AppVersionState {
  /** Resolved studio version (sans leading "v"). `null` until the IPC lands. */
  version: string | null
  /** True while the initial fetch is in flight. */
  isLoading: boolean
  /** Idempotent — kicks off the fetch on first call, no-op afterwards. */
  loadVersion: () => Promise<void>
}

export const useAppVersionStore = create<AppVersionState>()((set, get) => ({
  version: null,
  isLoading: false,

  loadVersion: async () => {
    // Already resolved or in flight — nothing to do. The studio version
    // doesn't change mid-session, so a single fetch is sufficient.
    if (get().version !== null || get().isLoading) return
    set({ isLoading: true })
    try {
      const v = await appIpc.version()
      set({ version: v, isLoading: false })
    } catch {
      // The version is best-effort cosmetic data — swallow IPC failures and
      // leave the store at `null` so consumers render their "—" fallback.
      set({ isLoading: false })
    }
  },
}))

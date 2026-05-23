// firstRun.store.ts — First-run onboarding state (issue #1015, S-H-3).
//
// Previously `useFirstRunCheck` fired `sessionIpc.getFirstRunCompleted()` from
// inside `useEffect` and held the resolved value in local `useState`. That
// matches the "useEffect for data fetching" anti-pattern called out by the
// studio rule. The IPC + state machine now live here; the hook becomes a thin
// selector that schedules a single `load()` call when its consumer mounts.
//
// `load()` is idempotent — the welcome modal only ever needs the flag once
// per session and the hook may be mounted from more than one place.

import { create } from 'zustand'
import { sessionIpc } from '../services/ipc.service'

export type FirstRunStatus = 'loading' | 'pending' | 'completed'

interface FirstRunState {
  status: FirstRunStatus
  /** True while the initial IPC fetch is in-flight. */
  isLoading: boolean
  /** Idempotent — kicks off the fetch on first call, no-op afterwards. */
  load: () => Promise<void>
  /**
   * Mark the onboarding flag as completed and persist via IPC. Updates the
   * local status optimistically — persistence failures are swallowed so the
   * user keeps the dismissed state for at least this session.
   */
  markCompleted: () => void
}

export const useFirstRunStore = create<FirstRunState>()((set, get) => ({
  status: 'loading',
  isLoading: false,

  load: async () => {
    // Already resolved or in flight — nothing to do. The flag never flips
    // back to pending within a session.
    if (get().status !== 'loading' || get().isLoading) return
    set({ isLoading: true })
    try {
      const completed = await sessionIpc.getFirstRunCompleted()
      set({ status: completed ? 'completed' : 'pending', isLoading: false })
    } catch {
      // If we can't read the flag, suppress onboarding rather than nag.
      // A broken userData file shouldn't trap the user behind the modal.
      set({ status: 'completed', isLoading: false })
    }
  },

  markCompleted: () => {
    set({ status: 'completed' })
    void sessionIpc.markFirstRunCompleted().catch(() => {
      // Best-effort persistence — user keeps the dismissed state for this session.
    })
  },
}))

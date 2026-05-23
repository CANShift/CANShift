// useFirstRunCheck.ts — Renderer-side selector around the first-run store.
//
// Issue #1015 (S-H-3) moved the IPC + state transitions into
// `firstRun.store.ts` so we follow the studio rule "no useEffect for data
// fetching — use Zustand actions". This file is now a thin bridge: it selects
// from the store and schedules the initial fetch on mount.

import { useEffect } from 'react'
import { useFirstRunStore, type FirstRunStatus } from '../stores/firstRun.store'

export type FirstRunState = FirstRunStatus

export interface UseFirstRunCheckResult {
  state: FirstRunState
  markCompleted: () => void
}

export function useFirstRunCheck(): UseFirstRunCheckResult {
  const state = useFirstRunStore((s) => s.status)
  const load = useFirstRunStore((s) => s.load)
  const markCompleted = useFirstRunStore((s) => s.markCompleted)

  // Idiomatic Zustand bridge — the side effect is in the store action; this
  // effect only schedules the first invocation when the consumer mounts.
  useEffect(() => {
    void load()
  }, [load])

  return { state, markCompleted }
}

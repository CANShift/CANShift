// useFirstRunCheck.ts — Resolve the first-run onboarding state from the main process.
//
// Reads `session.firstRunCompleted` once on mount and exposes a stable
// `markCompleted()` callback that both persists the flag and updates the local
// state. Silently treats IPC failures as "already completed" so a broken
// userData file never traps the user behind the welcome modal.

import { useCallback, useEffect, useRef, useState } from 'react'
import { sessionIpc } from '../services/ipc.service'

export type FirstRunState = 'loading' | 'pending' | 'completed'

export interface UseFirstRunCheckResult {
  state: FirstRunState
  markCompleted: () => void
}

export function useFirstRunCheck(): UseFirstRunCheckResult {
  const [state, setState] = useState<FirstRunState>('loading')
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false
    void (async () => {
      try {
        const completed = await sessionIpc.getFirstRunCompleted()
        if (cancelledRef.current) return
        setState(completed ? 'completed' : 'pending')
      } catch {
        if (cancelledRef.current) return
        // If we can't read the flag, suppress onboarding rather than nag.
        setState('completed')
      }
    })()
    return () => {
      cancelledRef.current = true
    }
  }, [])

  const markCompleted = useCallback(() => {
    setState('completed')
    void sessionIpc.markFirstRunCompleted().catch(() => {
      // Best-effort persistence — user keeps the dismissed state for this session.
    })
  }, [])

  return { state, markCompleted }
}

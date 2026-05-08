// burnFailure.store.ts — State for the blocking modal shown when a burn fails.
//
// burnConfig() in useConfigActions populates this store on failure so that
// BurnFailedDialog can surface the error + remediation hints in a way the
// user can't miss (#376). The modal is additive — the toast + ErrorBar paths
// are preserved.

import { create } from 'zustand'

export interface BurnFailureDetails {
  message: string
  hints: string[]
  elapsedMs: number
  schemaVersion: string
  payloadBytes: number
}

interface BurnFailureState {
  visible: boolean
  details: BurnFailureDetails | null
  onRetry: (() => void) | null

  show: (details: BurnFailureDetails, onRetry: () => void) => void
  dismiss: () => void
}

export const useBurnFailureStore = create<BurnFailureState>()((set) => ({
  visible: false,
  details: null,
  onRetry: null,

  show: (details, onRetry) => {
    set({ visible: true, details, onRetry })
  },

  dismiss: () => {
    set({ visible: false, details: null, onRetry: null })
  },
}))

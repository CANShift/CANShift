// pushDiff.store.ts — State for the "diff before burn" confirmation dialog.
//
// When the user pushes a config to the device and a previous push exists,
// this store holds the two configs and the callback to execute on confirmation.

import { create } from 'zustand'
import type { DashboardConfig } from '@tmbk/canshift-core'

interface PushDiffState {
  visible: boolean
  currentConfig: DashboardConfig | null
  lastPushedConfig: DashboardConfig | null
  onConfirm: (() => void) | null

  show: (current: DashboardConfig, last: DashboardConfig | null, onConfirm: () => void) => void
  dismiss: () => void
}

export const usePushDiffStore = create<PushDiffState>()((set) => ({
  visible: false,
  currentConfig: null,
  lastPushedConfig: null,
  onConfirm: null,

  show: (current, last, onConfirm) => {
    set({ visible: true, currentConfig: current, lastPushedConfig: last, onConfirm })
  },

  dismiss: () => {
    set({ visible: false, currentConfig: null, lastPushedConfig: null, onConfirm: null })
  },
}))

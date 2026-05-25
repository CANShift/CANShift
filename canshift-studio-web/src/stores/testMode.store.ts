// testMode.store.ts — Studio-only signal value injection for offline testing.
//
// When `enabled` is true, the editor previews read values from `values` keyed by
// signal name instead of the static demo percentage. Lets the user verify
// thresholds, alerts, and edge values without a live ECU connected.

import { create } from 'zustand'
import type { SignalDef } from '@tmbk/canshift-core'

interface TestModeState {
  enabled: boolean
  /** signalName → injected raw value (post-scale, in widget units) */
  values: Record<string, number>

  setEnabled: (enabled: boolean) => void
  setValue: (signalName: string, value: number) => void
  /** Initialise values for any signals missing a pinned value, using midpoints. */
  syncFromSignals: (signals: SignalDef[]) => void
  /** Drop pinned values for signals that no longer exist. */
  pruneMissing: (signals: SignalDef[]) => void
  reset: () => void
}

function midpoint(s: SignalDef): number {
  if (Number.isFinite(s.min) && Number.isFinite(s.max) && s.max > s.min) {
    return (s.min + s.max) / 2
  }
  return 0
}

export const useTestModeStore = create<TestModeState>()((set) => ({
  enabled: false,
  values: {},

  setEnabled: (enabled) => {
    set({ enabled })
  },

  setValue: (signalName, value) => {
    set((s) => ({ values: { ...s.values, [signalName]: value } }))
  },

  syncFromSignals: (signals) => {
    set((s) => {
      const next = { ...s.values }
      let changed = false
      for (const sig of signals) {
        if (!(sig.name in next)) {
          next[sig.name] = midpoint(sig)
          changed = true
        }
      }
      return changed ? { values: next } : {}
    })
  },

  pruneMissing: (signals) => {
    set((s) => {
      const known = new Set(signals.map((sig) => sig.name))
      const next: Record<string, number> = {}
      let changed = false
      for (const [name, value] of Object.entries(s.values)) {
        if (known.has(name)) next[name] = value
        else changed = true
      }
      return changed ? { values: next } : {}
    })
  },

  reset: () => {
    set({ enabled: false, values: {} })
  },
}))

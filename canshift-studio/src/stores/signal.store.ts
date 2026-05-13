// signal.store.ts — Available CAN signals with localStorage persistence.
//
// `applyProfile` is the only write path that persists — inline edits via
// `setSignals` (the signal table) are kept in memory only until the next
// explicit profile selection.

import { create } from 'zustand'
import type { SignalDef } from '@tmbk/canshift-core'
import { DEFAULT_PROFILE_ID } from '@tmbk/canshift-core'

const STORAGE_KEY = 'canshift:signal-store-v1'
export const DEFAULT_PROFILE_KEY = `builtin:${DEFAULT_PROFILE_ID}`

interface StoredState {
  selectedProfileKey: string
  signals: SignalDef[]
}

function readStored(): StoredState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).selectedProfileKey !== 'string' ||
      !Array.isArray((parsed as Record<string, unknown>).signals)
    )
      return null
    return parsed as StoredState
  } catch {
    return null
  }
}

function writeStored(state: StoredState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage unavailable — keep in-memory state only
  }
}

interface SignalState {
  signals: SignalDef[]
  selectedProfileKey: string
  /** Inline edits only — does not persist the profile selection. */
  setSignals: (signals: SignalDef[]) => void
  /** Switches to a profile and persists the selection for next launch. */
  applyProfile: (key: string, signals: SignalDef[]) => void
}

const stored = readStored()

export const useSignalStore = create<SignalState>()((set) => ({
  signals: stored?.signals ?? [],
  selectedProfileKey: stored?.selectedProfileKey ?? DEFAULT_PROFILE_KEY,

  setSignals: (signals) => {
    set({ signals })
  },

  applyProfile: (key, signals) => {
    set({ selectedProfileKey: key, signals })
    writeStored({ selectedProfileKey: key, signals })
  },
}))

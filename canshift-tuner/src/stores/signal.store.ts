import { create } from 'zustand'
import type { SignalDef } from '@tmbk/canshift-core'
import { DEFAULT_PROFILE_ID, ECU_PROFILES } from '@tmbk/canshift-core'

const FALLBACK_PROFILE_ID = 'maxxecu-street'
const FALLBACK_SIGNALS: SignalDef[] =
  ECU_PROFILES.find((p) => p.id === FALLBACK_PROFILE_ID)?.signals ?? []

const STORAGE_KEY = 'canshift:signal-store-v1'
export const DEFAULT_PROFILE_KEY = `builtin:${DEFAULT_PROFILE_ID}`

interface StoredState {
  selectedProfileKey: string
  signals: SignalDef[]
}

const readStored = (): StoredState | null => {
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

const writeStored = (state: StoredState): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    void 0
  }
}

interface SignalState {
  signals: SignalDef[]
  selectedProfileKey: string
  setSignals: (signals: SignalDef[]) => void
  applyProfile: (key: string, signals: SignalDef[]) => void
}

const stored = readStored()

const initialSignals: SignalDef[] =
  stored && stored.signals.length > 0 ? stored.signals : FALLBACK_SIGNALS

export const useSignalStore = create<SignalState>()((set) => ({
  signals: initialSignals,
  selectedProfileKey: stored?.selectedProfileKey ?? DEFAULT_PROFILE_KEY,

  setSignals: (signals) => {
    set({ signals })
  },

  applyProfile: (key, signals) => {
    set({ selectedProfileKey: key, signals })
    writeStored({ selectedProfileKey: key, signals })
  },
}))

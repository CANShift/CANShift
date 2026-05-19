// signal.store.ts — Available CAN signals with localStorage persistence.
//
// `applyProfile` is the only write path that persists — inline edits via
// `setSignals` (the signal table) are kept in memory only until the next
// explicit profile selection.

import { create } from 'zustand'
import type { SignalDef } from '@tmbk/canshift-core'
import { DEFAULT_PROFILE_ID, ECU_PROFILES } from '@tmbk/canshift-core'

// Fresh-start signal catalog. The bundled `generic-blank` default profile
// is empty by design ("fill in from your ECU's CAN documentation"), but an
// empty catalog also means `WidgetPreview`'s `useResolvedSignalUnit` hook
// returns "" for every widget — so the studio preview ships without any
// unit labels until the user manually picks a profile. Falling back to
// the MaxxECU profile's signals (which matches what the firmware ships
// in `data/config/signals.json`) populates units (\`rpm\`, \`°C\`, \`km/h\`,
// \`AFR\`, …) on first load so the preview reads useful immediately.
const FALLBACK_PROFILE_ID = 'maxxecu-street'
const FALLBACK_SIGNALS: SignalDef[] =
  ECU_PROFILES.find((p) => p.id === FALLBACK_PROFILE_ID)?.signals ?? []

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

// Pick FALLBACK_SIGNALS even when localStorage holds an empty array. Earlier
// studio sessions persisted `signals: []` from the `generic-blank` default
// profile; `??` would happily keep that empty array and the preview ran with
// no units (the user complaint). Fall through to FALLBACK whenever the stored
// catalog is missing OR empty so widgets always have a unit table to look up.
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

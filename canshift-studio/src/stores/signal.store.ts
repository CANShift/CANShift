// signal.store.ts — Available CAN signals, pre-loaded from the bundled signals.json

import { create } from 'zustand'
import type { SignalDef } from '@tmbk/canshift-core'
import { ECU_PROFILES, DEFAULT_PROFILE_ID } from '@tmbk/canshift-core'

const defaultProfile = ECU_PROFILES.find((p) => p.id === DEFAULT_PROFILE_ID) ?? ECU_PROFILES[0]

interface SignalState {
  signals: SignalDef[]
  activeProfileId: string
  setSignals: (signals: SignalDef[]) => void
  loadProfile: (profileId: string) => void
}

export const useSignalStore = create<SignalState>()((set) => ({
  signals: defaultProfile.signals,
  activeProfileId: DEFAULT_PROFILE_ID,
  setSignals: (signals) => {
    set({ signals })
  },
  loadProfile: (profileId) => {
    const profile = ECU_PROFILES.find((p) => p.id === profileId)
    if (!profile) return
    set({ signals: profile.signals, activeProfileId: profileId })
  },
}))

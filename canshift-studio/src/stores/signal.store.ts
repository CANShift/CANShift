// signal.store.ts — Available CAN signals, pre-loaded from the bundled signals.json

import { create } from 'zustand'
import type { SignalDef } from '@tmbk/canshift-core'
import { ECU_PROFILES, DEFAULT_PROFILE_ID } from '@tmbk/canshift-core'

function getProfileSignals(profileId: string): SignalDef[] {
  return ECU_PROFILES.find((p) => p.id === profileId)?.signals ?? []
}

interface SignalState {
  signals: SignalDef[]
  activeProfileId: string
  setSignals: (signals: SignalDef[]) => void
  loadProfile: (profileId: string) => void
}

export const useSignalStore = create<SignalState>()((set) => ({
  signals: getProfileSignals(DEFAULT_PROFILE_ID),
  activeProfileId: DEFAULT_PROFILE_ID,
  setSignals: (signals) => {
    set({ signals })
  },
  loadProfile: (profileId) => {
    set({ signals: getProfileSignals(profileId), activeProfileId: profileId })
  },
}))

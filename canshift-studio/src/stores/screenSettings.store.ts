// screenSettings.store.ts — Physical screen display settings

import { create } from 'zustand'

export interface ScreenSettings {
  brightness: number // 0–100 %
  sleepTimeoutS: number // 0 = never, otherwise seconds before dimming
}

interface ScreenSettingsState extends ScreenSettings {
  set: (patch: Partial<ScreenSettings>) => void
  reset: () => void
}

const DEFAULTS: ScreenSettings = {
  brightness: 80,
  sleepTimeoutS: 0,
}

export const useScreenSettingsStore = create<ScreenSettingsState>()((set) => ({
  ...DEFAULTS,

  set: (patch) => {
    set((s) => ({ ...s, ...patch }))
  },

  reset: () => {
    set(DEFAULTS)
  },
}))

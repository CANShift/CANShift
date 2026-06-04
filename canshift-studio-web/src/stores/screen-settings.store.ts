// screenSettings.store.ts — Physical screen display settings

import { create } from 'zustand'

export type RotationOffset = 0 | 180

export interface ScreenSettings {
  brightness: number // 0–100 %
  sleepTimeoutS: number // 0 = never, otherwise seconds before dimming
  rotation: RotationOffset // mounting orientation offset from the firmware default
}

interface ScreenSettingsState extends ScreenSettings {
  // Renamed from `set` so it no longer shadows zustand's built-in `set`
  // method on the store, which made the action's name a footgun in store
  // initializers and in any code that imported `set` from outside the store
  // (R-8, issue #1288).
  update: (patch: Partial<ScreenSettings>) => void
}

const DEFAULTS: ScreenSettings = {
  brightness: 80,
  sleepTimeoutS: 0,
  rotation: 0,
}

export const useScreenSettingsStore = create<ScreenSettingsState>()((set) => ({
  ...DEFAULTS,

  update: (patch) => {
    set((s) => ({ ...s, ...patch }))
  },
}))

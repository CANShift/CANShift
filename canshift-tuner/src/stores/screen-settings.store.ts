import { create } from 'zustand'

export type RotationOffset = 0 | 180

export interface ScreenSettings {
  brightness: number
  sleepTimeoutS: number
  rotation: RotationOffset
}

interface ScreenSettingsState extends ScreenSettings {
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

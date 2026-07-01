import { create } from 'zustand'
import type { ScreenSettings } from '@tmbk/canshift-core'

export type RotationOffset = NonNullable<ScreenSettings['rotation']>

export type StoredScreenSettings = Required<ScreenSettings>

interface ScreenSettingsState extends StoredScreenSettings {
  update: (patch: Partial<StoredScreenSettings>) => void
}

const DEFAULTS: StoredScreenSettings = {
  brightness: 80,
  sleep: 0,
  rotation: 0,
}

export const useScreenSettingsStore = create<ScreenSettingsState>()((set) => ({
  ...DEFAULTS,

  update: (patch) => {
    set((s) => ({ ...s, ...patch }))
  },
}))

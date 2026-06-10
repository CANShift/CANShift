import { create } from 'zustand'
import { DEFAULT_DEVICE_CONFIG, type DeviceConfig } from '@tmbk/canshift-core'
import { deviceConfigIpc } from '../transport'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface DeviceConfigState {
  config: DeviceConfig
  loaded: boolean
  saveStatus: SaveStatus
  saveError: string | null

  load: () => Promise<void>
  setConfig: (next: DeviceConfig) => void
  updateConfig: (patch: Partial<DeviceConfig>) => void
  save: () => Promise<void>
  clearSaveStatus: () => void
}

export const useDeviceConfigStore = create<DeviceConfigState>()((set, get) => ({
  config: DEFAULT_DEVICE_CONFIG,
  loaded: false,
  saveStatus: 'idle',
  saveError: null,

  load: async () => {
    if (get().loaded) return
    try {
      const result = await deviceConfigIpc.read()
      if (result.success && result.config) {
        set({ config: result.config, loaded: true })
        return
      }
      set({ loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  setConfig: (next) => {
    set({ config: next })
  },

  updateConfig: (patch) => {
    set((s) => ({ config: { ...s.config, ...patch } }))
  },

  save: async () => {
    set({ saveStatus: 'saving', saveError: null })
    try {
      const result = await deviceConfigIpc.write(get().config)
      if (result.success) {
        set({ saveStatus: 'saved', saveError: null })
        return
      }
      set({ saveStatus: 'error', saveError: result.error ?? 'Save failed' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      set({ saveStatus: 'error', saveError: msg })
    }
  },

  clearSaveStatus: () => {
    set({ saveStatus: 'idle', saveError: null })
  },
}))

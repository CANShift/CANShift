// device-config.store.ts — ESP32 hardware config (CAN speed, TWAI pins).
//
// Mirrors the Electron Studio's `useDeviceConfigStore` pattern: owns the
// editable draft + the load/save lifecycle so the route surface stays a thin
// editor with no useEffect-based fetching anti-pattern.
//
// Backed by `deviceConfigIpc` from the dash-hosted transport — the IPC layer
// routes CMD_GET_DEVICE_CONFIG / CMD_PUT_DEVICE_CONFIG through the shared
// WsClient singleton. `load()` is idempotent across the session.

import { create } from 'zustand'
import { DEFAULT_DEVICE_CONFIG, type DeviceConfig } from '@tmbk/canshift-core'
import { deviceConfigIpc } from '../transport'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface DeviceConfigState {
  /** Editable draft of the device config. Starts at the canshift-core default. */
  config: DeviceConfig
  /** True once the initial IPC `read()` has resolved (success or failure). */
  loaded: boolean
  saveStatus: SaveStatus
  saveError: string | null

  /** Idempotent — fetches once per session, no-op afterwards. */
  load: () => Promise<void>
  /** Replace the in-memory draft (no IPC). */
  setConfig: (next: DeviceConfig) => void
  /** Patch a subset of the draft fields. */
  updateConfig: (patch: Partial<DeviceConfig>) => void
  /** Persist the draft via IPC and update `saveStatus`. */
  save: () => Promise<void>
  /** Reset the transient `saveStatus` (used after the "Saved" badge fades). */
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
      // No on-device config yet — keep the default draft and mark loaded so
      // the route stops showing a spinner.
      set({ loaded: true })
    } catch {
      // Best-effort — surface defaults so the user can edit and push fresh.
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

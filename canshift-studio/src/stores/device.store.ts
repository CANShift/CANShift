// device.store.ts — USB device connection state

import { create } from 'zustand'

interface DeviceState {
  connected: boolean
  portPath: string | null
  firmwareVersion: string | null
  lastSyncAt: Date | null
  syncing: boolean

  setConnected: (connected: boolean, portPath?: string) => void
  setSyncing: (syncing: boolean) => void
  setSyncComplete: (at: Date) => void
  setFirmwareVersion: (version: string) => void
}

export const useDeviceStore = create<DeviceState>()((set) => ({
  connected: false,
  portPath: null,
  firmwareVersion: null,
  lastSyncAt: null,
  syncing: false,

  setConnected: (connected, portPath) => {
    set({ connected, portPath: portPath ?? null })
  },

  setSyncing: (syncing) => {
    set({ syncing })
  },

  setSyncComplete: (at) => {
    set({ lastSyncAt: at, syncing: false })
  },

  setFirmwareVersion: (version) => {
    set({ firmwareVersion: version })
  },
}))

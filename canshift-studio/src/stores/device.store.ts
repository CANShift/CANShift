// device.store.ts — USB device connection state

import { create } from 'zustand'

export type ConnectionStatus = 'disconnected' | 'connected' | 'burning' | 'error'

interface DeviceState {
  status: ConnectionStatus
  portPath: string | null
  firmwareVersion: string | null
  lastSyncAt: Date | null
  errorMessage: string | null

  // Derived helpers
  connected: boolean
  syncing: boolean

  // Simulation mode — behaves as connected without physical hardware
  simulationMode: boolean

  setConnected: (portPath: string) => void
  setDisconnected: () => void
  setSyncing: (syncing: boolean) => void
  setSyncComplete: (at: Date) => void
  setError: (message: string) => void
  clearError: () => void
  setFirmwareVersion: (version: string) => void
  enterSimulation: () => void
  exitSimulation: () => void
}

export const useDeviceStore = create<DeviceState>()((set) => ({
  status: 'disconnected',
  portPath: null,
  firmwareVersion: null,
  lastSyncAt: null,
  errorMessage: null,
  connected: false,
  syncing: false,
  simulationMode: false,

  setConnected: (portPath) => {
    set({ status: 'connected', portPath, connected: true, syncing: false, errorMessage: null })
  },

  setDisconnected: () => {
    set({ status: 'disconnected', portPath: null, connected: false, syncing: false })
  },

  setSyncing: (syncing) => {
    set((s) => ({
      status: syncing ? 'burning' : s.connected ? 'connected' : 'disconnected',
      syncing,
    }))
  },

  setSyncComplete: (at) => {
    set({ status: 'connected', lastSyncAt: at, syncing: false })
  },

  setError: (message) => {
    set({ status: 'error', errorMessage: message, syncing: false })
  },

  clearError: () => {
    set((s) => ({
      status: s.connected ? 'connected' : 'disconnected',
      errorMessage: null,
    }))
  },

  setFirmwareVersion: (version) => {
    set({ firmwareVersion: version })
  },

  enterSimulation: () => {
    set({ simulationMode: true, status: 'connected', connected: true, portPath: null })
  },

  exitSimulation: () => {
    set({ simulationMode: false, status: 'disconnected', connected: false, portPath: null })
  },
}))

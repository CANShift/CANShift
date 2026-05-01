// device.store.ts — USB device connection state

import { create } from 'zustand'
import type { DashboardConfig } from '@tmbk/canshift-core'

export type ConnectionStatus = 'disconnected' | 'connected' | 'burning' | 'error'

/** Controls the firmware flash / update dialog. */
export interface FirmwareDialogState {
  visible: boolean
  /** 'flash' = device has no firmware; 'update' = outdated firmware. */
  mode: 'flash' | 'update' | null
}

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

  // Firmware dialog
  firmwareDialog: FirmwareDialogState

  setConnected: (portPath: string) => void
  setDisconnected: () => void
  setSyncing: (syncing: boolean) => void
  setSyncComplete: (at: Date) => void
  setError: (message: string) => void
  clearError: () => void
  setFirmwareVersion: (version: string | null) => void
  setFirmwareDialog: (state: FirmwareDialogState) => void
  enterSimulation: () => void
  exitSimulation: () => void

  // Last config successfully pushed to the device (for diff before next burn)
  lastPushedConfig: DashboardConfig | null
  setLastPushedConfig: (config: DashboardConfig) => void
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
  firmwareDialog: { visible: false, mode: null },
  lastPushedConfig: null,

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

  setFirmwareDialog: (state) => {
    set({ firmwareDialog: state })
  },

  enterSimulation: () => {
    set({ simulationMode: true, status: 'connected', connected: true, portPath: null })
  },

  exitSimulation: () => {
    set({ simulationMode: false, status: 'disconnected', connected: false, portPath: null })
  },

  setLastPushedConfig: (config) => {
    set({ lastPushedConfig: config })
  },
}))

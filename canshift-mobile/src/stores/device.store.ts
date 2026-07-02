import { create } from 'zustand'
import type { BleConnectionError } from '../services/ble.errors'

export type ConnectionState = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error'

export type DeviceMode = 'idle' | 'sim' | 'ble'

interface DeviceState {
  connectionState: ConnectionState
  mode: DeviceMode
  deviceId: string | null
  deviceName: string | null
  firmwareVersion: string | null
  canHealthy: boolean
  isDayMode: boolean | null
  error: BleConnectionError | null

  setConnectionState: (s: ConnectionState) => void
  setMode: (m: DeviceMode) => void
  setDevice: (id: string, name: string) => void
  setFirmwareStatus: (version: string, canHealthy: boolean) => void
  setIsDayMode: (v: boolean) => void
  setError: (err: BleConnectionError | null) => void
  clearError: () => void
  disconnect: () => void
}

export const useDeviceStore = create<DeviceState>()((set) => ({
  connectionState: 'idle',
  mode: 'idle',
  deviceId: null,
  deviceName: null,
  firmwareVersion: null,
  canHealthy: false,
  isDayMode: null,
  error: null,

  setConnectionState: (connectionState) => {
    set({ connectionState })
  },

  setMode: (mode) => {
    set({ mode })
  },

  setDevice: (deviceId, deviceName) => {
    set({ deviceId, deviceName, connectionState: 'connected', error: null })
  },

  setFirmwareStatus: (firmwareVersion, canHealthy) => {
    set({ firmwareVersion, canHealthy })
  },

  setIsDayMode: (isDayMode) => {
    set({ isDayMode })
  },

  setError: (error) => {
    set({ error, connectionState: 'error' })
  },

  clearError: () => {
    set({ error: null, connectionState: 'idle' })
  },

  disconnect: () => {
    set({
      connectionState: 'idle',
      mode: 'idle',
      deviceId: null,
      deviceName: null,
      firmwareVersion: null,
      canHealthy: false,
      isDayMode: null,
      error: null,
    })
  },
}))

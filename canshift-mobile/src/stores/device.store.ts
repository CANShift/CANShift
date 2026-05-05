// device.store.ts — BLE connection state

import { create } from 'zustand'

export type ConnectionState = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error'

interface DeviceState {
  connectionState: ConnectionState
  deviceId: string | null
  deviceName: string | null
  firmwareVersion: string | null
  canHealthy: boolean
  wifiApSsid: string | null
  isDayMode: boolean | null
  error: string | null

  setConnectionState: (s: ConnectionState) => void
  setDevice: (id: string, name: string) => void
  setFirmwareStatus: (version: string, canHealthy: boolean) => void
  setWifiAp: (ssid: string | null) => void
  setIsDayMode: (v: boolean) => void
  setError: (msg: string | null) => void
  disconnect: () => void
}

export const useDeviceStore = create<DeviceState>()((set) => ({
  connectionState: 'idle',
  deviceId: null,
  deviceName: null,
  firmwareVersion: null,
  canHealthy: false,
  wifiApSsid: null,
  isDayMode: null,
  error: null,

  setConnectionState: (connectionState) => set({ connectionState }),

  setDevice: (deviceId, deviceName) =>
    set({ deviceId, deviceName, connectionState: 'connected', error: null }),

  setFirmwareStatus: (firmwareVersion, canHealthy) => set({ firmwareVersion, canHealthy }),

  setWifiAp: (wifiApSsid) => set({ wifiApSsid }),

  setIsDayMode: (isDayMode) => set({ isDayMode }),

  setError: (error) => set({ error, connectionState: 'error' }),

  disconnect: () =>
    set({
      connectionState: 'idle',
      deviceId: null,
      deviceName: null,
      firmwareVersion: null,
      canHealthy: false,
      wifiApSsid: null,
      isDayMode: null,
      error: null,
    }),
}))

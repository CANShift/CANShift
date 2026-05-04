// device.store.ts — BLE connection state

import { create } from 'zustand'

export type ConnectionState = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error'

interface DeviceState {
  connectionState: ConnectionState
  deviceId: string | null       // BLE device ID
  deviceName: string | null
  firmwareVersion: string | null
  canHealthy: boolean
  wifiApSsid: string | null     // set when WiFi AP is active
  error: string | null

  setConnectionState: (s: ConnectionState) => void
  setDevice: (id: string, name: string) => void
  setFirmwareStatus: (version: string, canHealthy: boolean) => void
  setWifiAp: (ssid: string | null) => void
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
  error: null,

  setConnectionState: (connectionState) => set({ connectionState }),

  setDevice: (deviceId, deviceName) =>
    set({ deviceId, deviceName, connectionState: 'connected', error: null }),

  setFirmwareStatus: (firmwareVersion, canHealthy) => set({ firmwareVersion, canHealthy }),

  setWifiAp: (wifiApSsid) => set({ wifiApSsid }),

  setError: (error) => set({ error, connectionState: 'error' }),

  disconnect: () =>
    set({
      connectionState: 'idle',
      deviceId: null,
      deviceName: null,
      firmwareVersion: null,
      canHealthy: false,
      wifiApSsid: null,
      error: null,
    }),
}))

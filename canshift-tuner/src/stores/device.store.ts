import { create } from 'zustand'
import type { DashboardConfig } from '@tmbk/canshift-core'

export type ConnectionStatus = 'disconnected' | 'connected' | 'burning' | 'error'

export type Transport = 'usb' | 'wifi'

export type BurnPhase = 'idle' | 'pushing' | 'rebooting' | 'done'

export type FirmwareCheck =
  | { kind: 'idle' }
  | { kind: 'probing' }
  | { kind: 'no_firmware' }
  | { kind: 'up_to_date'; version: string; checkedAt: number }
  | { kind: 'update_available'; version: string; latestVersion: string; checkedAt: number }
  | { kind: 'check_failed'; version: string; checkedAt: number }

export type FirmwareCompat =
  | { kind: 'unknown' }
  | { kind: 'compatible'; protocol: number }
  | { kind: 'mismatch'; expected: number; got: number; version: string }

export type FirmwareLiveness =
  | { kind: 'unknown' }
  | { kind: 'alive'; lastPongAt: number; uptimeMs: number | null }
  | { kind: 'unresponsive'; missedPings: number; sinceMs: number }

export interface HeapStatsEntry {
  tsMs: number
  freeInternal: number
  largestInternal: number
  freePsram: number | null
  largestPsram: number | null
  receivedAt: number
}

export const HEAP_STATS_RING_CAP = 360

interface DeviceState {
  status: ConnectionStatus
  portPath: string | null
  transport: Transport | null
  wifiHost: string | null
  firmwareVersion: string | null
  lastSyncAt: Date | null
  errorMessage: string | null

  connected: boolean
  syncing: boolean

  simulationMode: boolean

  firmwareCheck: FirmwareCheck

  firmwareCompat: FirmwareCompat

  firmwareLiveness: FirmwareLiveness

  heapStats: HeapStatsEntry[]

  firmwareCheckTick: number

  isDayMode: boolean | null

  setConnected: (portPath: string) => void
  setConnectedWifi: (host: string) => void
  setDisconnected: () => void
  setSyncing: (syncing: boolean) => void
  setSyncComplete: (at: Date) => void
  setError: (message: string) => void
  clearError: () => void
  setFirmwareVersion: (version: string | null) => void
  setFirmwareCheck: (check: FirmwareCheck) => void
  setFirmwareCompat: (compat: FirmwareCompat) => void
  setFirmwareLiveness: (liveness: FirmwareLiveness) => void
  pushHeapStats: (entry: Omit<HeapStatsEntry, 'receivedAt'>) => void
  clearHeapStats: () => void
  requestFirmwareRecheck: () => void
  setIsDayMode: (isDay: boolean | null) => void
  enterSimulation: () => void
  exitSimulation: () => void

  lastPushedConfig: DashboardConfig | null
  setLastPushedConfig: (config: DashboardConfig) => void

  burnPhase: BurnPhase
  setBurnPhase: (phase: BurnPhase) => void

  flashing: boolean
  setFlashing: (flashing: boolean) => void

  manualDisconnect: boolean
  setManualDisconnect: (manual: boolean) => void
}

const MANUAL_DISCONNECT_KEY = 'canshift:manual-disconnect'

const readManualDisconnect = (): boolean => {
  try {
    return sessionStorage.getItem(MANUAL_DISCONNECT_KEY) === '1'
  } catch {
    return false
  }
}

const writeManualDisconnect = (flag: boolean): void => {
  try {
    if (flag) sessionStorage.setItem(MANUAL_DISCONNECT_KEY, '1')
    else sessionStorage.removeItem(MANUAL_DISCONNECT_KEY)
  } catch {
    void 0
  }
}

export const useDeviceStore = create<DeviceState>()((set) => ({
  status: 'disconnected',
  portPath: null,
  transport: null,
  wifiHost: null,
  firmwareVersion: null,
  lastSyncAt: null,
  errorMessage: null,
  connected: false,
  syncing: false,
  simulationMode: false,
  firmwareCheck: { kind: 'idle' },
  firmwareCheckTick: 0,
  firmwareCompat: { kind: 'unknown' },
  firmwareLiveness: { kind: 'unknown' },
  heapStats: [],
  isDayMode: null,
  lastPushedConfig: null,
  burnPhase: 'idle',
  flashing: false,
  manualDisconnect: readManualDisconnect(),

  setConnected: (portPath) => {
    set({
      status: 'connected',
      portPath,
      transport: 'usb',
      wifiHost: null,
      connected: true,
      simulationMode: false,
      syncing: false,
      errorMessage: null,
    })
  },

  setConnectedWifi: (host) => {
    set({
      status: 'connected',
      portPath: null,
      transport: 'wifi',
      wifiHost: host,
      connected: true,
      simulationMode: false,
      syncing: false,
      errorMessage: null,
    })
  },

  setDisconnected: () => {
    set({
      status: 'disconnected',
      portPath: null,
      transport: null,
      wifiHost: null,
      connected: false,
      syncing: false,
      isDayMode: null,
      firmwareCheck: { kind: 'idle' },
      firmwareCheckTick: 0,
      firmwareCompat: { kind: 'unknown' },
      firmwareLiveness: { kind: 'unknown' },
      heapStats: [],
      lastPushedConfig: null,
    })
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

  setFirmwareCheck: (check) => {
    set({ firmwareCheck: check })
  },

  setFirmwareCompat: (compat) => {
    set({ firmwareCompat: compat })
  },

  setFirmwareLiveness: (liveness) => {
    set({ firmwareLiveness: liveness })
  },

  pushHeapStats: (entry) => {
    set((s) => {
      const next = s.heapStats.concat({ ...entry, receivedAt: Date.now() })
      if (next.length > HEAP_STATS_RING_CAP) {
        next.splice(0, next.length - HEAP_STATS_RING_CAP)
      }
      return { heapStats: next }
    })
  },

  clearHeapStats: () => {
    set({ heapStats: [] })
  },

  requestFirmwareRecheck: () => {
    set((s) => ({ firmwareCheckTick: s.firmwareCheckTick + 1 }))
  },

  setIsDayMode: (isDay) => {
    set({ isDayMode: isDay })
  },

  enterSimulation: () => {
    set({
      simulationMode: true,
      status: 'connected',
      connected: true,
      portPath: null,
      transport: null,
      wifiHost: null,
    })
  },

  exitSimulation: () => {
    set({
      simulationMode: false,
      status: 'disconnected',
      connected: false,
      portPath: null,
      transport: null,
      wifiHost: null,
    })
  },

  setLastPushedConfig: (config) => {
    set({ lastPushedConfig: config })
  },

  setBurnPhase: (phase) => {
    set({ burnPhase: phase })
  },

  setFlashing: (flashing) => {
    set({ flashing })
  },

  setManualDisconnect: (manual) => {
    writeManualDisconnect(manual)
    set({ manualDisconnect: manual })
  },
}))

import { create } from 'zustand'
import type { DashboardConfig } from '@tmbk/canshift-core'

export type ConnectionStatus = 'disconnected' | 'connected' | 'burning' | 'error'

export type Transport = 'usb'

export type BurnPhase = 'idle' | 'pushing' | 'rebooting' | 'done'

export type BurnResult = { kind: 'success' } | { kind: 'error'; message: string }

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
  firmwareVersion: string | null
  lastSyncAt: Date | null
  errorMessage: string | null

  connected: boolean
  syncing: boolean

  simulationMode: boolean
  simulationDismissed: boolean

  firmwareCompat: FirmwareCompat

  firmwareLiveness: FirmwareLiveness

  heapStats: HeapStatsEntry[]

  isDayMode: boolean | null

  setConnected: (portPath: string) => void
  setDisconnected: (error?: string | null) => void
  setSyncing: (syncing: boolean) => void
  setSyncComplete: (at: Date) => void
  setError: (message: string) => void
  clearError: () => void
  setFirmwareVersion: (version: string | null) => void
  setFirmwareCompat: (compat: FirmwareCompat) => void
  setFirmwareLiveness: (liveness: FirmwareLiveness) => void
  pushHeapStats: (entry: Omit<HeapStatsEntry, 'receivedAt'>) => void
  clearHeapStats: () => void
  setIsDayMode: (isDay: boolean | null) => void
  enterSimulation: () => void
  exitSimulation: () => void

  lastPushedConfig: DashboardConfig | null
  setLastPushedConfig: (config: DashboardConfig) => void

  burnPhase: BurnPhase
  setBurnPhase: (phase: BurnPhase) => void

  lastBurnResult: BurnResult | null
  setLastBurnResult: (result: BurnResult | null) => void
}

export const useDeviceStore = create<DeviceState>()((set) => ({
  status: 'disconnected',
  portPath: null,
  transport: null,
  firmwareVersion: null,
  lastSyncAt: null,
  errorMessage: null,
  connected: false,
  syncing: false,
  simulationMode: false,
  simulationDismissed: false,
  firmwareCompat: { kind: 'unknown' },
  firmwareLiveness: { kind: 'unknown' },
  heapStats: [],
  isDayMode: null,
  lastPushedConfig: null,
  burnPhase: 'idle',
  lastBurnResult: null,

  setConnected: (portPath) => {
    set({
      status: 'connected',
      portPath,
      transport: 'usb',
      connected: true,
      simulationMode: false,
      syncing: false,
      errorMessage: null,
    })
  },

  setDisconnected: (error) => {
    set({
      status: error ? 'error' : 'disconnected',
      portPath: null,
      transport: null,
      connected: false,
      syncing: false,
      isDayMode: null,
      firmwareVersion: null,
      firmwareCompat: { kind: 'unknown' },
      firmwareLiveness: { kind: 'unknown' },
      heapStats: [],
      lastPushedConfig: null,
      burnPhase: 'idle',
      lastBurnResult: null,
      errorMessage: error ?? null,
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

  setIsDayMode: (isDay) => {
    set({ isDayMode: isDay })
  },

  enterSimulation: () => {
    set({
      simulationMode: true,
      simulationDismissed: false,
      status: 'connected',
      connected: true,
      portPath: null,
      transport: null,
    })
  },

  exitSimulation: () => {
    set({
      simulationMode: false,
      simulationDismissed: true,
      status: 'disconnected',
      connected: false,
      portPath: null,
      transport: null,
    })
  },

  setLastPushedConfig: (config) => {
    set({ lastPushedConfig: config })
  },

  setBurnPhase: (phase) => {
    set({ burnPhase: phase })
  },

  setLastBurnResult: (result) => {
    set({ lastBurnResult: result })
  },
}))

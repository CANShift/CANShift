// device.store.ts — Device connection state (USB or WiFi).
//
// Transport selection is recorded alongside the existing `connected` flag:
// the renderer's command-issuing code stays transport-agnostic (the IPC
// dispatch routes through the active transport in main), but UI surfaces
// that need to label the active link (TopBar, ConnectModal) read `transport`.

import { create } from 'zustand'
import type { DashboardConfig } from '@tmbk/canshift-core'

export type ConnectionStatus = 'disconnected' | 'connected' | 'burning' | 'error'

/**
 * Active link between Studio and the dash (issue #1071).
 * `null` while disconnected; otherwise the underlying transport that flipped
 * `connected:true`. The renderer never branches on this for commands — it's
 * a display-only signal (TopBar label, modal status row).
 */
export type Transport = 'usb' | 'wifi'

/**
 * Visible stage of the burn cycle, drives BurnProgressModal:
 *   idle       — no burn in flight
 *   pushing    — sending the JSON over USB; waiting for firmware ack
 *   rebooting  — firmware has acked + is now writing to storage and rebooting;
 *                connection has dropped, auto-connect is trying to come back
 *   done       — device reconnected after the reboot; modal shows a short
 *                success state then returns to idle
 */
export type BurnPhase = 'idle' | 'pushing' | 'rebooting' | 'done'

/**
 * Result of probing the device firmware version against the latest GitHub
 * release. Drives the SideRail update dot, the StatusBar (update) hint and
 * the UpdateRoute panel header.
 *
 *   idle             — no probe yet (no device, simulation, or already latched)
 *   probing          — CMD_GET_STATUS in flight
 *   no_firmware      — two consecutive misses → device has no CANShift firmware
 *   up_to_date       — version matches latest stable release (or list unavailable)
 *   update_available — newer release is available
 *   check_failed     — version probed but release list lookup threw
 */
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
  /**
   * Active transport while `connected`. `null` when disconnected. Display-only:
   * the IPC layer in main dispatches every device command through the active
   * transport, so call sites never read this to pick a code path (#1071).
   */
  transport: Transport | null
  /** Host address while `transport === 'wifi'`. `null` otherwise. */
  wifiHost: string | null
  firmwareVersion: string | null
  lastSyncAt: Date | null
  errorMessage: string | null

  // Derived helpers
  connected: boolean
  syncing: boolean

  // Simulation mode — behaves as connected without physical hardware
  simulationMode: boolean

  /** Result of the firmware check pipeline (probe + release comparison). */
  firmwareCheck: FirmwareCheck

  firmwareCompat: FirmwareCompat

  firmwareLiveness: FirmwareLiveness

  heapStats: HeapStatsEntry[]

  /**
   * Bump-counter consumed by useFirmwareCheck to force a re-probe on demand
   * (e.g. the user clicked "Check now" in UpdateRoute). Storing the trigger
   * in the store keeps the recheck call site decoupled from the orchestrator
   * hook, which is mounted once at App.tsx.
   */
  firmwareCheckTick: number

  /**
   * Mirrors the firmware's day/night mode. `null` until reported by
   * CMD_GET_STATUS — older firmware (< 0.7.0) doesn't send the field.
   */
  isDayMode: boolean | null

  setConnected: (portPath: string) => void
  /** Mark the device as connected over WiFi at `host`. */
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
  /** Trigger a re-probe — useFirmwareCheck listens on `firmwareCheckTick`. */
  requestFirmwareRecheck: () => void
  setIsDayMode: (isDay: boolean | null) => void
  enterSimulation: () => void
  exitSimulation: () => void

  // Last config successfully pushed to the device (for diff before next burn)
  lastPushedConfig: DashboardConfig | null
  setLastPushedConfig: (config: DashboardConfig) => void

  /** Current burn-cycle stage, drives BurnProgressModal. */
  burnPhase: BurnPhase
  setBurnPhase: (phase: BurnPhase) => void

  /**
   * True while `useFirmwareFlash.flash()` is in flight. UpdateRoute drives a
   * flash from the panel; `useAutoConnect` checks this so its 2 s reconnect
   * poll cannot grab the serial port back from esptool-js mid-flash.
   */
  flashing: boolean
  setFlashing: (flashing: boolean) => void

  /**
   * Set to true when the user explicitly disconnects via the UI, and cleared
   * the moment they invoke `connect()` manually. `useAutoConnect` reads this
   * to suppress its 2 s reconnect poll — otherwise clicking Disconnect would
   * be visually undone within seconds. Persisted in sessionStorage so a page
   * refresh keeps the user disconnected, but a full app restart starts
   * with auto-connect enabled (matches the original UX). Issue #977.
   */
  manualDisconnect: boolean
  setManualDisconnect: (manual: boolean) => void
}

// Manual-disconnect flag lives in sessionStorage so a page refresh during a
// user's "stay disconnected" window keeps that intent. App restart (new
// session) clears it — auto-connect re-engages on a clean boot. Wrapped in
// try/catch because sessionStorage can throw under privacy-mode browsers
// and on the Electron renderer if storage isn't ready yet.
const MANUAL_DISCONNECT_KEY = 'canshift:manual-disconnect'

function readManualDisconnect(): boolean {
  try {
    return sessionStorage.getItem(MANUAL_DISCONNECT_KEY) === '1'
  } catch {
    return false
  }
}

function writeManualDisconnect(flag: boolean): void {
  try {
    if (flag) sessionStorage.setItem(MANUAL_DISCONNECT_KEY, '1')
    else sessionStorage.removeItem(MANUAL_DISCONNECT_KEY)
  } catch {
    // sessionStorage unavailable — in-memory state still tracks the flag.
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
      // A live device link supersedes the dev-only simulation mode — they
      // can't coexist, otherwise the Editor reads from DEFAULT_SIM_CONFIG
      // while the device pushes real values and the user sees "Simulation"
      // in the Header even though WebSerial is up.
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
      // Clear `lastPushedConfig` too — it represents the config running on the
      // device we were connected to. Keeping it after disconnect makes the
      // diff dialog show "Modified" against the *previous* device on the next
      // connect+push, even when the new device runs a completely different
      // image (audit S-L-6).
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

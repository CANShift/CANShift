// device.store.ts — USB device connection state

import { create } from 'zustand'
import type { DashboardConfig } from '@tmbk/canshift-core'
import type { SdRuntimeState } from '../services/ipc.service'

export type ConnectionStatus = 'disconnected' | 'connected' | 'burning' | 'error'

/**
 * Visible stage of the burn cycle, drives BurnProgressModal:
 *   idle       — no burn in flight
 *   pushing    — sending the JSON over USB; waiting for firmware ack
 *   rebooting  — firmware has acked + is now writing to SD and rebooting;
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

  /** Result of the firmware check pipeline (probe + release comparison). */
  firmwareCheck: FirmwareCheck

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

  /**
   * Mirrors the firmware's runtime SD-card state from CMD_GET_STATUS (issue #252).
   * 'unknown' is the default both before the first probe and on firmware that
   * predates the additive field — see `isSdWritable()` for the policy.
   */
  sdState: SdRuntimeState

  setConnected: (portPath: string) => void
  setDisconnected: () => void
  setSyncing: (syncing: boolean) => void
  setSyncComplete: (at: Date) => void
  setError: (message: string) => void
  clearError: () => void
  setFirmwareVersion: (version: string | null) => void
  setFirmwareCheck: (check: FirmwareCheck) => void
  /** Trigger a re-probe — useFirmwareCheck listens on `firmwareCheckTick`. */
  requestFirmwareRecheck: () => void
  setIsDayMode: (isDay: boolean | null) => void
  setSdState: (state: SdRuntimeState) => void
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
  firmwareCheck: { kind: 'idle' },
  firmwareCheckTick: 0,
  isDayMode: null,
  sdState: 'unknown',
  lastPushedConfig: null,
  burnPhase: 'idle',
  flashing: false,

  setConnected: (portPath) => {
    set({ status: 'connected', portPath, connected: true, syncing: false, errorMessage: null })
  },

  setDisconnected: () => {
    set({
      status: 'disconnected',
      portPath: null,
      connected: false,
      syncing: false,
      isDayMode: null,
      sdState: 'unknown',
      firmwareCheck: { kind: 'idle' },
      firmwareCheckTick: 0,
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

  requestFirmwareRecheck: () => {
    set((s) => ({ firmwareCheckTick: s.firmwareCheckTick + 1 }))
  },

  setIsDayMode: (isDay) => {
    set({ isDayMode: isDay })
  },

  setSdState: (state) => {
    set({ sdState: state })
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

  setBurnPhase: (phase) => {
    set({ burnPhase: phase })
  },

  setFlashing: (flashing) => {
    set({ flashing })
  },
}))

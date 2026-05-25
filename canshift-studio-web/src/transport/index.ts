// transport/index.ts — Dash-hosted transport stub (phase 1, spike #1104).
//
// Plays the role that `services/ipc.service.ts` plays in Electron Studio: a
// single typed surface every store/component reaches for when it needs to
// talk to the device. In phase 3 (#1105) the bodies of these functions get
// replaced with real `fetch(...)` calls and a single WebSocket subscription
// against the firmware's HTTP/WS endpoints. For now they return canned data
// so the renderer can mount, render, and have its bundle weight measured.
//
// Surface intentionally mirrors the existing services so the call sites in
// dashboard.store / Canvas / ScreenSettingsPanel keep working unchanged.

import type {
  DashboardConfig,
  SignalConfig,
  DeviceConfig,
  InputBindingsConfig,
  LatestReleaseResult,
} from '@tmbk/canshift-core'

// ---------------------------------------------------------------------------
// Shared result shapes — kept structurally identical to shared/ipc-contract.
// ---------------------------------------------------------------------------

export interface PortInfo {
  path: string
  manufacturer?: string
  serialNumber?: string
  productId?: string
  vendorId?: string
  description?: string
}

export interface UsbResult {
  success: boolean
  error?: string
}

export interface OpenResult {
  success: boolean
  cancelled?: boolean
  config?: DashboardConfig
  filePath?: string
  error?: string
}

export interface SaveResult {
  success: boolean
  cancelled?: boolean
  filePath?: string
  error?: string
}

export interface ConnectionStatus {
  connected: boolean
  portPath: string | null
  firmwareVersion?: string | null
}

// Mirrors canshift-core's ScreenSettings — re-exported here so the spike
// renderer keeps a single import surface without reaching into shared/.
export type { ScreenSettings as ScreenSettingsPayload } from '@tmbk/canshift-core'
import type { ScreenSettings } from '@tmbk/canshift-core'

export interface DiscoveredDevice {
  name: string
  host: string
  port: number
  hostname?: string
}

export interface WifiStatus {
  connected: boolean
  host?: string
  port?: number
}

export type DeviceConfigResult =
  | { kind: 'ok'; config: DashboardConfig }
  | { kind: 'none' }
  | { kind: 'error'; error: string }

// Canned "no device" status — every getter resolves with a connected:false
// shape so the connect screen renders even without firmware in the loop.
const DISCONNECTED: ConnectionStatus = { connected: false, portPath: null, firmwareVersion: null }
const OK: UsbResult = { success: true }

// ---------------------------------------------------------------------------
// Config file operations
// ---------------------------------------------------------------------------

export const configService = {
  open: (): Promise<OpenResult> => Promise.resolve({ success: false, cancelled: true }),
  openPath: (_filePath: string): Promise<OpenResult> =>
    Promise.resolve({ success: false, cancelled: true }),
  save: (_config: DashboardConfig): Promise<SaveResult> =>
    Promise.resolve({ success: false, cancelled: true }),
  saveAs: (_config: DashboardConfig): Promise<SaveResult> =>
    Promise.resolve({ success: false, cancelled: true }),
  import: (): Promise<OpenResult> => Promise.resolve({ success: false, cancelled: true }),
  export: (_config: DashboardConfig): Promise<SaveResult> =>
    Promise.resolve({ success: false, cancelled: true }),
}

// ---------------------------------------------------------------------------
// Session persistence — browser localStorage is intentionally NOT used here
// (decision: dash owns persistence). Stub returns "no prior session".
// ---------------------------------------------------------------------------

export const sessionIpc = {
  getLastFilePath: (): Promise<string | null> => Promise.resolve(null),
  getLastPortPath: (): Promise<string | null> => Promise.resolve(null),
  getFirstRunCompleted: (): Promise<boolean> => Promise.resolve(true),
  markFirstRunCompleted: (): Promise<void> => Promise.resolve(),
  resetFirstRun: (): Promise<void> => Promise.resolve(),
}

// ---------------------------------------------------------------------------
// USB device operations — every command resolves "ok, but nothing happened".
// Phase 3 replaces these with WS commands against the dash.
// ---------------------------------------------------------------------------

export const usbService = {
  listPorts: (): Promise<PortInfo[]> => Promise.resolve([]),
  connect: (_portPath: string): Promise<UsbResult> => Promise.resolve(OK),
  disconnect: (): Promise<UsbResult> => Promise.resolve(OK),
  pushConfig: (_config: DashboardConfig): Promise<UsbResult> => Promise.resolve(OK),
  pushScreenSettings: (_settings: ScreenSettings): Promise<UsbResult> => Promise.resolve(OK),
  getStatus: (): Promise<ConnectionStatus> => Promise.resolve(DISCONNECTED),
  reboot: (): Promise<UsbResult> => Promise.resolve(OK),
  toggleDayNight: (): Promise<UsbResult> => Promise.resolve(OK),
  setDayNight: (_day: boolean): Promise<UsbResult> => Promise.resolve(OK),
  calibrateTouch: (): Promise<UsbResult> => Promise.resolve(OK),
}

export const wifiService = {
  discover: (): Promise<DiscoveredDevice[]> => Promise.resolve([]),
  connect: (_host: string, _port?: number): Promise<UsbResult> => Promise.resolve(OK),
  disconnect: (): Promise<UsbResult> => Promise.resolve(OK),
  getStatus: (): Promise<WifiStatus> => Promise.resolve({ connected: false }),
}

export const deviceIpc = {
  getConfig: (): Promise<DeviceConfigResult> => Promise.resolve({ kind: 'none' as const }),
}

export const canScannerIpc = {
  start: (): Promise<{ success: boolean; error?: string }> => Promise.resolve({ success: false }),
  stop: (): Promise<{ success: boolean; error?: string }> => Promise.resolve({ success: false }),
}

export const deviceConfigIpc = {
  read: (): Promise<{ success: boolean; config: DeviceConfig | null }> =>
    Promise.resolve({ success: true, config: null }),
  write: (_config: DeviceConfig): Promise<{ success: boolean; error?: string }> =>
    Promise.resolve({ success: true }),
}

export const inputBindingsIpc = {
  read: (): Promise<{ success: boolean; config: InputBindingsConfig | null }> =>
    Promise.resolve({ success: true, config: null }),
  write: (_config: InputBindingsConfig): Promise<{ success: boolean; error?: string }> =>
    Promise.resolve({ success: true }),
}

export const appIpc = {
  version: (): Promise<string> => Promise.resolve('0.0.0-spike'),
}

export const releasesIpc = {
  // Phase 3 wires this against a dash-hosted /releases endpoint. Until then
  // the stub returns the "no live data, no cache" shape so the renderer can
  // render the empty/error state without crashing.
  getLatest: (_force = false): Promise<LatestReleaseResult> =>
    Promise.resolve({
      ok: false,
      reason: 'offline',
      message: 'spike-stub: release info disabled in phase-1',
      fetchedAt: new Date(0).toISOString(),
      cached: null,
    }),
}

export const signalIpc = {
  export: (
    _config: SignalConfig
  ): Promise<{ success: boolean; filePath?: string; error?: string }> =>
    Promise.resolve({ success: false }),
}

// ---------------------------------------------------------------------------
// Event subscriptions — Electron's `window.ipc.on(channel, listener)` returned
// nothing; we return an unsubscribe so phase-3 callers can swap the body for
// a real WS subscription without restructuring the call sites.
// ---------------------------------------------------------------------------

export type Unsubscribe = () => void
type Handler<T> = (event: T) => void

const noopSubscribe = <T,>(_handler: Handler<T>): Unsubscribe => () => {}

export const deviceEvents = {
  /** Device log lines (e.g. `[BOOT] CANShift vX.Y.Z`). Phase-3: WS frames. */
  onLogLine: noopSubscribe,
  /** CAN frames captured by the scanner. Phase-3: WS frames. */
  onCanFrame: noopSubscribe,
  /** Live signal values for the editor preview. Phase-3: WS frames. */
  onSignal: noopSubscribe,
  /** USB/WS connection state changes. Phase-3: WS handshake events. */
  onConnectionChange: noopSubscribe,
}

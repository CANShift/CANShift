// transport/index.ts — Dash-hosted transport surface (#1077 phase 3).
//
// Plays the role that `services/ipc.service.ts` plays in Electron Studio: a
// single typed surface every store/component reaches for when it needs to
// talk to the device. The bodies are now backed by `WsClient` against the
// firmware's `/ws` port-81 endpoint (#1108) — the function signatures stay
// identical to the phase-1 stub so call sites in Canvas / ScreenSettingsPanel
// / useLiveSignals didn't need restructuring.
//
// Anything that used to be Electron-host-only (file dialogs, native menus,
// release feed, esptool) stays stubbed — those surfaces are out of scope for
// the dash-hosted renderer per the architectural freeze in #1077.

import type {
  DashboardConfig,
  SignalConfig,
  DeviceConfig,
  InputBindingsConfig,
  LatestReleaseResult,
  ScreenSettings,
} from '@tmbk/canshift-core'
import { getWsClient } from './ws-client'

// ---------------------------------------------------------------------------
// Firmware command opcodes — sourced from `canshift-studio/main/services/`.
// ---------------------------------------------------------------------------

const CMD_GET_CONFIG = 0x01
const CMD_PUSH_CONFIG = 0x02
const CMD_SCREEN_SETTINGS = 0x05
const CMD_TOGGLE_DAY_NIGHT = 0x07
const CMD_CALIBRATE_TOUCH = 0x08
const CMD_SET_DAY_NIGHT = 0x09
const CMD_QUERY_VERSION = 0x10
const CMD_CAN_SCAN_START = 0x20
const CMD_CAN_SCAN_STOP = 0x21
const CMD_REBOOT = 0xf0

// ---------------------------------------------------------------------------
// Shared result shapes — kept structurally identical to the phase-1 stub.
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

export type { ScreenSettings as ScreenSettingsPayload } from '@tmbk/canshift-core'

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

const OK: UsbResult = { success: true }

function toUsbResult(result: { ok: boolean; error?: string }): UsbResult {
  if (result.ok) return OK
  return { success: false, error: result.error ?? 'unknown_error' }
}

// ---------------------------------------------------------------------------
// Config file operations — stubbed. The dash-hosted renderer doesn't own a
// native file system; import/export will land later as a dash-side endpoint
// (open question logged in README).
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
// Session persistence — dash owns it (no browser localStorage for config per
// the #1077 architectural freeze). The host/port pair the user picks lives in
// `connection.store.ts` instead (UI preference, not device config).
// ---------------------------------------------------------------------------

export const sessionIpc = {
  getLastFilePath: (): Promise<string | null> => Promise.resolve(null),
  getLastPortPath: (): Promise<string | null> => Promise.resolve(null),
  getFirstRunCompleted: (): Promise<boolean> => Promise.resolve(true),
  markFirstRunCompleted: (): Promise<void> => Promise.resolve(),
  resetFirstRun: (): Promise<void> => Promise.resolve(),
}

// ---------------------------------------------------------------------------
// Device commands — the public surface call sites depend on. Backed by the
// shared `WsClient` singleton; the name `usbService` is preserved so the
// phase-1 imports keep compiling.
// ---------------------------------------------------------------------------

export const usbService = {
  /** USB port listing is unused on the dash transport — return empty. */
  listPorts: (): Promise<PortInfo[]> => Promise.resolve([]),
  connect: (_portPath: string): Promise<UsbResult> => Promise.resolve(OK),
  disconnect: (): Promise<UsbResult> => Promise.resolve(OK),

  pushConfig: async (config: DashboardConfig): Promise<UsbResult> => {
    const result = await getWsClient().send(
      CMD_PUSH_CONFIG,
      { payload: config },
      { scaleWithPayload: true }
    )
    return toUsbResult(result)
  },

  pushScreenSettings: async (settings: ScreenSettings): Promise<UsbResult> => {
    const result = await getWsClient().send(CMD_SCREEN_SETTINGS, { ...settings })
    return toUsbResult(result)
  },

  getStatus: (): Promise<ConnectionStatus> => {
    const client = getWsClient()
    return Promise.resolve({
      connected: client.getStatus() === 'connected',
      portPath: null,
      firmwareVersion: null,
    })
  },

  reboot: async (): Promise<UsbResult> => {
    // Reboot drops the socket before any ack lands; treat a missing ack as
    // success so the UI doesn't surface a spurious timeout.
    const result = await getWsClient().send(CMD_REBOOT, {}, { timeoutMs: 1_000 })
    if (result.ok) return OK
    if (result.error === 'ack_timeout' || result.error === 'connection_closed') return OK
    return toUsbResult(result)
  },

  toggleDayNight: async (): Promise<UsbResult> => {
    return toUsbResult(await getWsClient().send(CMD_TOGGLE_DAY_NIGHT))
  },

  setDayNight: async (day: boolean): Promise<UsbResult> => {
    return toUsbResult(await getWsClient().send(CMD_SET_DAY_NIGHT, { day }))
  },

  calibrateTouch: async (): Promise<UsbResult> => {
    return toUsbResult(await getWsClient().send(CMD_CALIBRATE_TOUCH))
  },
}

// WiFi discovery via mDNS isn't available from the browser — the user
// types/selects the host manually in the connection screen. Kept as a noop
// surface so any phase-1 caller still mounts.
export const wifiService = {
  discover: (): Promise<DiscoveredDevice[]> => Promise.resolve([]),
  connect: (_host: string, _port?: number): Promise<UsbResult> => Promise.resolve(OK),
  disconnect: (): Promise<UsbResult> => Promise.resolve(OK),
  getStatus: (): Promise<WifiStatus> => {
    const client = getWsClient()
    return Promise.resolve({
      connected: client.getStatus() === 'connected',
      host: client.getHost(),
      port: client.getPort(),
    })
  },
}

export const deviceIpc = {
  getConfig: async (): Promise<DeviceConfigResult> => {
    const result = await getWsClient().send(CMD_GET_CONFIG, {}, { timeoutMs: 8_000 })
    if (result.ok) {
      const cfg = result.data?.config
      if (cfg && typeof cfg === 'object') {
        return { kind: 'ok', config: cfg as DashboardConfig }
      }
      return { kind: 'none' }
    }
    if (result.error === 'config_not_found') return { kind: 'none' }
    return { kind: 'error', error: result.error ?? 'unknown_error' }
  },
}

export const canScannerIpc = {
  start: async (): Promise<{ success: boolean; error?: string }> => {
    return toUsbResult(await getWsClient().send(CMD_CAN_SCAN_START))
  },
  stop: async (): Promise<{ success: boolean; error?: string }> => {
    return toUsbResult(await getWsClient().send(CMD_CAN_SCAN_STOP))
  },
}

// Device-level metadata reads — dash doesn't expose dedicated endpoints for
// these yet; phase 4 wires them. Until then the stubs keep the editor mounted.
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
  version: (): Promise<string> => Promise.resolve('0.0.0-web'),
}

export const releasesIpc = {
  // Dash-hosted release feed lands in a later sub-issue under #1077.
  getLatest: (_force = false): Promise<LatestReleaseResult> =>
    Promise.resolve({
      ok: false,
      reason: 'offline',
      message: 'web: release feed not yet wired',
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
// Event subscriptions — backed by `WsClient.subscribe()` discriminator routing.
// Each helper returns an unsubscribe so the call sites (`useLiveSignals` et al.)
// keep their existing teardown shape.
// ---------------------------------------------------------------------------

export type Unsubscribe = () => void
type Handler<T> = (event: T) => void

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export const deviceEvents = {
  /** Device log lines. Frame shape: `{ log: 1, lvl, tag, msg }`. */
  onLogLine: (handler: Handler<{ level: string; tag: string; message: string }>): Unsubscribe => {
    return getWsClient().subscribe('log', (frame) => {
      if (!isRecord(frame)) return
      handler({
        level: typeof frame.lvl === 'string' ? frame.lvl : 'I',
        tag: typeof frame.tag === 'string' ? frame.tag : '',
        message: typeof frame.msg === 'string' ? frame.msg : '',
      })
    })
  },

  /** Raw CAN frames captured by the scanner. Shape: `{ can: 1, id, len, d }`. */
  onCanFrame: (handler: Handler<{ id: number; len: number; data: number[] }>): Unsubscribe => {
    return getWsClient().subscribe('can', (frame) => {
      if (!isRecord(frame)) return
      const id = typeof frame.id === 'number' ? frame.id : null
      const len = typeof frame.len === 'number' ? frame.len : null
      const raw = Array.isArray(frame.d) ? frame.d : null
      if (id === null || len === null || raw === null) return
      const data = raw.filter((b): b is number => typeof b === 'number')
      handler({ id, len, data })
    })
  },

  /** Live signal values. Shape: `{ tele: 1, v: { signalName: number } }`. */
  onSignal: (handler: Handler<Record<string, number>>): Unsubscribe => {
    return getWsClient().subscribe('tele', (frame) => {
      if (!isRecord(frame)) return
      const values = frame.v
      if (!isRecord(values)) return
      const flat: Record<string, number> = {}
      for (const [k, v] of Object.entries(values)) {
        if (typeof v === 'number') flat[k] = v
      }
      handler(flat)
    })
  },

  /**
   * CAN health snapshot. Shape: `{ can_stat: 1, fps, errors }`. The phase-1
   * stub passed `unknown` through; we surface a typed shape here.
   */
  onCanHealth: (handler: Handler<{ fps: number; errors: number }>): Unsubscribe => {
    return getWsClient().subscribe('can_stat', (frame) => {
      if (!isRecord(frame)) return
      handler({
        fps: typeof frame.fps === 'number' ? frame.fps : 0,
        errors: typeof frame.errors === 'number' ? frame.errors : 0,
      })
    })
  },

  /**
   * Connection state changes. Wired off the `WsClient` status — emits
   * `{ connected: true }` on OPEN and `{ connected: false, reason? }` on every
   * disconnect / reconnect attempt.
   */
  onConnectionChange: (
    handler: Handler<{ connected: boolean; reason?: string }>
  ): Unsubscribe => {
    return getWsClient().onStatus((status, error) => {
      if (status === 'connected') {
        handler({ connected: true })
      } else if (error !== undefined) {
        handler({ connected: false, reason: error })
      } else {
        handler({ connected: false })
      }
    })
  },
}

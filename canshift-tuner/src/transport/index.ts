import type {
  DashboardConfig,
  DeviceConfig,
  InputBindingsConfig,
  ScreenSettings,
} from '@tmbk/canshift-core'
import {
  CanFrameSchema,
  DeviceConfigSchema,
  DeviceConfigWireSchema,
  HeapStatsFrameSchema,
  InputBindingsConfigSchema,
  InputBindingsConfigWireSchema,
  LogFrameSchema,
  TeleFrameSchema,
  deviceConfigFromWire,
  deviceConfigToWire,
  inputBindingsFromWire,
  inputBindingsToWire,
} from '@tmbk/canshift-core'
import { getSerialClient } from './webserial-client'

const CMD_GET_CONFIG = 0x01
const CMD_PUSH_CONFIG = 0x02
const CMD_GET_DEVICE_CONFIG = 0x03
const CMD_PUT_DEVICE_CONFIG = 0x04
const CMD_SCREEN_SETTINGS = 0x05
const CMD_TOGGLE_DAY_NIGHT = 0x07
const CMD_CALIBRATE_TOUCH = 0x08
const CMD_SET_DAY_NIGHT = 0x09
const CMD_GET_INPUT_BINDINGS = 0x0b
const CMD_PUT_INPUT_BINDINGS = 0x0c
const CMD_QUERY_VERSION = 0x10
const CMD_PING = 0x11
const CMD_CAN_SCAN_START = 0x20
const CMD_CAN_SCAN_STOP = 0x21
const CMD_REBOOT = 0xf0

export interface KnownOpcode {
  id: number
  name: string
  description: string
}

export const KNOWN_OPCODES: readonly KnownOpcode[] = [
  { id: CMD_GET_CONFIG, name: 'CMD_GET_CONFIG', description: 'Read dashboard JSON from device' },
  { id: CMD_PUSH_CONFIG, name: 'CMD_PUSH_CONFIG', description: 'Write dashboard JSON (reboots)' },
  {
    id: CMD_GET_DEVICE_CONFIG,
    name: 'CMD_GET_DEVICE_CONFIG',
    description: 'Read hardware device config',
  },
  {
    id: CMD_PUT_DEVICE_CONFIG,
    name: 'CMD_PUT_DEVICE_CONFIG',
    description: 'Write hardware device config',
  },
  { id: CMD_SCREEN_SETTINGS, name: 'CMD_SCREEN_SETTINGS', description: 'Brightness, rotation' },
  {
    id: CMD_TOGGLE_DAY_NIGHT,
    name: 'CMD_TOGGLE_DAY_NIGHT',
    description: 'Flip day/night theme',
  },
  { id: CMD_CALIBRATE_TOUCH, name: 'CMD_CALIBRATE_TOUCH', description: 'Enter touch calibration' },
  {
    id: CMD_SET_DAY_NIGHT,
    name: 'CMD_SET_DAY_NIGHT',
    description: 'Set day/night theme — payload { day: boolean }',
  },
  {
    id: CMD_GET_INPUT_BINDINGS,
    name: 'CMD_GET_INPUT_BINDINGS',
    description: 'Read input bindings',
  },
  {
    id: CMD_PUT_INPUT_BINDINGS,
    name: 'CMD_PUT_INPUT_BINDINGS',
    description: 'Write input bindings',
  },
  {
    id: CMD_QUERY_VERSION,
    name: 'CMD_QUERY_VERSION',
    description: 'Firmware version handshake',
  },
  { id: CMD_PING, name: 'CMD_PING', description: 'Liveness probe — replies with uptime_ms' },
  { id: CMD_CAN_SCAN_START, name: 'CMD_CAN_SCAN_START', description: 'Start CAN scan' },
  { id: CMD_CAN_SCAN_STOP, name: 'CMD_CAN_SCAN_STOP', description: 'Stop CAN scan' },
  { id: CMD_REBOOT, name: 'CMD_REBOOT', description: 'Reboot the dash' },
]

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

export interface ConnectionStatus {
  connected: boolean
  portPath: string | null
  firmwareVersion?: string | null
}

export interface FirmwareIdentity {
  version: string
  protocol: number
  isDay: boolean
}

export type FirmwareIdentityResult =
  | { kind: 'ok'; identity: FirmwareIdentity }
  | { kind: 'error'; error: string }

export type PingResult = { kind: 'ok'; uptimeMs: number | null } | { kind: 'error'; error: string }

export type RawAck =
  | { kind: 'ok'; data: Record<string, unknown> }
  | { kind: 'error'; error: string; data: Record<string, unknown> | null }

export type { ScreenSettings as ScreenSettingsPayload } from '@tmbk/canshift-core'

export type DeviceConfigResult =
  | { kind: 'ok'; config: DashboardConfig }
  | { kind: 'none' }
  | { kind: 'error'; error: string }

const OK: UsbResult = { success: true }

const toUsbResult = (result: { ok: boolean; error?: string }): UsbResult =>
  result.ok ? OK : { success: false, error: result.error ?? 'unknown_error' }

export const usbService = {
  listPorts: (): Promise<PortInfo[]> => Promise.resolve([]),
  connect: (_portPath: string): Promise<UsbResult> => Promise.resolve(OK),
  disconnect: (): Promise<UsbResult> => Promise.resolve(OK),

  pushConfig: async (config: DashboardConfig): Promise<UsbResult> => {
    const result = await getSerialClient().send(
      CMD_PUSH_CONFIG,
      { payload: config },
      { scaleWithPayload: true }
    )
    return toUsbResult(result)
  },

  pushScreenSettings: async (settings: ScreenSettings): Promise<UsbResult> => {
    const result = await getSerialClient().send(CMD_SCREEN_SETTINGS, { ...settings })
    return toUsbResult(result)
  },

  getStatus: (): Promise<ConnectionStatus> => {
    const client = getSerialClient()
    return Promise.resolve({
      connected: client.getStatus() === 'connected',
      portPath: null,
      firmwareVersion: null,
    })
  },

  ping: async (timeoutMs = 1_500): Promise<PingResult> => {
    const result = await getSerialClient().send(CMD_PING, {}, { timeoutMs })
    if (!result.ok) {
      return { kind: 'error', error: result.error ?? 'unknown_error' }
    }
    const uptimeMs = typeof result.data?.uptime_ms === 'number' ? result.data.uptime_ms : null
    return { kind: 'ok', uptimeMs }
  },

  queryVersion: async (): Promise<FirmwareIdentityResult> => {
    const result = await getSerialClient().send(CMD_QUERY_VERSION, {}, { timeoutMs: 2_000 })
    if (!result.ok) {
      return { kind: 'error', error: result.error ?? 'unknown_error' }
    }
    const d = result.data
    if (!d || typeof d.version !== 'string' || typeof d.protocol !== 'number') {
      return { kind: 'error', error: 'invalid_response' }
    }
    return {
      kind: 'ok',
      identity: {
        version: d.version,
        protocol: d.protocol,
        isDay: d.is_day === 1,
      },
    }
  },

  reboot: async (): Promise<UsbResult> => {
    const result = await getSerialClient().send(CMD_REBOOT, {}, { timeoutMs: 1_000 })
    if (result.ok) return OK
    if (result.error === 'ack_timeout' || result.error === 'connection_closed') return OK
    return toUsbResult(result)
  },

  toggleDayNight: async (): Promise<UsbResult> => {
    return toUsbResult(await getSerialClient().send(CMD_TOGGLE_DAY_NIGHT))
  },

  setDayNight: async (day: boolean): Promise<UsbResult> => {
    return toUsbResult(await getSerialClient().send(CMD_SET_DAY_NIGHT, { day }))
  },

  calibrateTouch: async (): Promise<UsbResult> => {
    return toUsbResult(await getSerialClient().send(CMD_CALIBRATE_TOUCH))
  },

  sendRaw: async (
    cmd: number,
    fields: Record<string, unknown> = {},
    timeoutMs = 3_000
  ): Promise<RawAck> => {
    const result = await getSerialClient().send(cmd, fields, { timeoutMs })
    if (result.ok) {
      return { kind: 'ok', data: result.data ?? {} }
    }
    return { kind: 'error', error: result.error ?? 'unknown_error', data: result.data ?? null }
  },
}

export const deviceIpc = {
  getConfig: async (): Promise<DeviceConfigResult> => {
    const result = await getSerialClient().send(CMD_GET_CONFIG, {}, { timeoutMs: 8_000 })
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
    return toUsbResult(await getSerialClient().send(CMD_CAN_SCAN_START))
  },
  stop: async (): Promise<{ success: boolean; error?: string }> => {
    return toUsbResult(await getSerialClient().send(CMD_CAN_SCAN_STOP))
  },
}

export const deviceConfigIpc = {
  read: async (): Promise<{ success: boolean; config: DeviceConfig | null; error?: string }> => {
    const result = await getSerialClient().send(CMD_GET_DEVICE_CONFIG)
    if (!result.ok) {
      if (result.error === 'config_not_found') return { success: true, config: null }
      return { success: false, config: null, error: result.error ?? 'unknown_error' }
    }
    const raw = result.data?.device_config
    if (!raw || typeof raw !== 'object') return { success: true, config: null }
    const parsed = DeviceConfigWireSchema.safeParse(raw)
    if (!parsed.success) {
      return { success: false, config: null, error: 'invalid_device_config' }
    }
    return { success: true, config: deviceConfigFromWire(parsed.data) }
  },

  write: async (config: DeviceConfig): Promise<{ success: boolean; error?: string }> => {
    const parsed = DeviceConfigSchema.safeParse(config)
    if (!parsed.success) {
      return { success: false, error: 'invalid_device_config' }
    }
    const wire = deviceConfigToWire(parsed.data)
    const result = await getSerialClient().send(CMD_PUT_DEVICE_CONFIG, { device_config: wire })
    if (result.ok) return { success: true }
    return { success: false, error: result.error ?? 'unknown_error' }
  },
}

export const inputBindingsIpc = {
  read: async (): Promise<{
    success: boolean
    config: InputBindingsConfig | null
    error?: string
  }> => {
    const result = await getSerialClient().send(CMD_GET_INPUT_BINDINGS)
    if (!result.ok) {
      if (result.error === 'config_not_found') {
        return { success: true, config: { inputBindings: [] } }
      }
      return { success: false, config: null, error: result.error ?? 'unknown_error' }
    }
    const raw = result.data?.input_bindings
    if (raw === undefined) {
      return { success: true, config: { inputBindings: [] } }
    }
    const wireDoc = Array.isArray(raw) ? { input_bindings: raw } : raw
    const parsed = InputBindingsConfigWireSchema.safeParse(wireDoc)
    if (!parsed.success) {
      return { success: false, config: null, error: 'invalid_input_bindings' }
    }
    return { success: true, config: inputBindingsFromWire(parsed.data) }
  },

  write: async (config: InputBindingsConfig): Promise<{ success: boolean; error?: string }> => {
    const parsed = InputBindingsConfigSchema.safeParse(config)
    if (!parsed.success) {
      return { success: false, error: 'invalid_input_bindings' }
    }
    const wire = inputBindingsToWire(parsed.data)
    const result = await getSerialClient().send(CMD_PUT_INPUT_BINDINGS, wire)
    if (result.ok) return { success: true }
    return { success: false, error: result.error ?? 'unknown_error' }
  },
}

export type Unsubscribe = () => void
type Handler<T> = (event: T) => void

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const SEEN_SCHEMA_ERRORS_CAP = 100
const seenSchemaErrors = new Set<string>()

const warnFrameDrop = (discriminator: string, code: string, sample: string): void => {
  const key = `${discriminator}:${code}`
  if (seenSchemaErrors.has(key)) return
  if (seenSchemaErrors.size >= SEEN_SCHEMA_ERRORS_CAP) {
    const oldest = seenSchemaErrors.values().next().value
    if (oldest !== undefined) seenSchemaErrors.delete(oldest)
  }
  seenSchemaErrors.add(key)
  console.warn(`[serial] dropping ${discriminator} frame — ${code} (${sample})`)
}

export const deviceEvents = {
  onLogLine: (handler: Handler<{ level: string; tag: string; message: string }>): Unsubscribe => {
    return getSerialClient().subscribe('log', (frame) => {
      const parsed = LogFrameSchema.safeParse(frame)
      if (!parsed.success) {
        warnFrameDrop('log', parsed.error.issues[0]?.code ?? 'unknown', JSON.stringify(frame))
        return
      }
      handler({
        level: parsed.data.lvl,
        tag: parsed.data.tag,
        message: parsed.data.msg,
      })
    })
  },

  onCanFrame: (handler: Handler<{ id: number; len: number; data: number[] }>): Unsubscribe => {
    return getSerialClient().subscribe('can', (frame) => {
      const parsed = CanFrameSchema.safeParse(frame)
      if (!parsed.success) {
        warnFrameDrop('can', parsed.error.issues[0]?.code ?? 'unknown', JSON.stringify(frame))
        return
      }
      if (!isRecord(frame)) return
      const id = typeof frame.id === 'number' ? frame.id : null
      const len = typeof frame.len === 'number' ? frame.len : null
      const raw = Array.isArray(frame.d) ? frame.d : null
      if (id === null || len === null || raw === null) return
      const data = raw.filter((b): b is number => typeof b === 'number')
      handler({ id, len, data })
    })
  },

  onSignal: (handler: Handler<Record<string, number>>): Unsubscribe => {
    return getSerialClient().subscribe('tele', (frame) => {
      const parsed = TeleFrameSchema.safeParse(frame)
      if (!parsed.success) {
        warnFrameDrop('tele', parsed.error.issues[0]?.code ?? 'unknown', JSON.stringify(frame))
        return
      }
      const flat: Record<string, number> = {}
      for (const [k, v] of Object.entries(parsed.data.v)) {
        if (typeof v === 'number') flat[k] = v
      }
      handler(flat)
    })
  },

  onHeapStats: (
    handler: Handler<{
      tsMs: number
      freeInternal: number
      largestInternal: number
      freePsram: number | null
      largestPsram: number | null
    }>
  ): Unsubscribe => {
    return getSerialClient().subscribe('heap_stats', (frame) => {
      const parsed = HeapStatsFrameSchema.safeParse(frame)
      if (!parsed.success) {
        warnFrameDrop(
          'heap_stats',
          parsed.error.issues[0]?.code ?? 'unknown',
          JSON.stringify(frame)
        )
        return
      }
      handler({
        tsMs: parsed.data.ts,
        freeInternal: parsed.data.free_int,
        largestInternal: parsed.data.largest_int,
        freePsram: parsed.data.free_psram,
        largestPsram: parsed.data.largest_psram,
      })
    })
  },

  onCanHealth: (handler: Handler<{ fps: number; errors: number }>): Unsubscribe => {
    return getSerialClient().subscribe('can_stat', (frame) => {
      if (!isRecord(frame)) return
      handler({
        fps: typeof frame.fps === 'number' ? frame.fps : 0,
        errors: typeof frame.errors === 'number' ? frame.errors : 0,
      })
    })
  },

  onConnectionChange: (handler: Handler<{ connected: boolean; reason?: string }>): Unsubscribe => {
    return getSerialClient().onStatus((status, error) => {
      if (status === 'connected') {
        handler({ connected: true })
      } else if (error !== undefined) {
        handler({ connected: false, reason: error })
      } else {
        handler({ connected: false })
      }
    })
  },

  onActivity: (handler: Handler<'rx' | 'tx'>): Unsubscribe => {
    return getSerialClient().onActivity(handler)
  },
}

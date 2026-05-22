// wifi.service.ts — TCP WiFi transport to the CANShift dash.
//
// Mirrors `usb.service.ts` byte-for-byte at the JSON-lines layer: every
// command/response/telemetry frame is a single `\n`-terminated JSON object,
// so the renderer's command-issuing code stays transport-agnostic.
//
// Discovery: mDNS via `bonjour-service`, browsing `_canshift._tcp` for ~3 s
// then resolving each instance's host/port. Manual host/port entry is the
// fallback for environments where mDNS is firewalled or unreliable.
//
// Concurrency: one connection per Studio instance. The dash refuses a second
// TCP client at accept time (firmware contract, issue #1071).

import { Socket } from 'node:net'
import Bonjour from 'bonjour-service'
import type { CanFrame, CanHealth } from '../../shared/usb.service.types'
import type { DeviceConfigResult } from '../../shared/ipc-payloads'

/**
 * Minimal structural view of a `bonjour-service` Service record. Declared
 * locally so the WiFi service doesn't depend on the package's export shape
 * (which uses `export = Bonjour` and exposes Service only via a namespace).
 * The fields below are the ones the dash actually populates.
 */
interface BonjourService {
  name?: string
  host?: string
  port?: number
  addresses?: readonly string[]
}

/** Default TCP port the dash advertises over mDNS. */
export const DEFAULT_WIFI_PORT = 5050

/** mDNS service type advertised by the dash. */
export const MDNS_SERVICE_TYPE = 'canshift'

/** How long the discovery sweep listens for `_canshift._tcp` responses. */
const DISCOVERY_WINDOW_MS = 3_000

/** Connection timeout — covers slow AP association on macOS / Linux. */
const CONNECT_TIMEOUT_MS = 5_000

/** Match USB ack timeout so command-issuing code can stay transport-agnostic. */
const ACK_TIMEOUT_MS = 5_000

/**
 * Heartbeat cadence — a single `\n` every 2 s. Matches USB so the dash's
 * "host active" timer behaves identically on both transports.
 */
const HEARTBEAT_INTERVAL_MS = 2_000

const PUT_CONFIG_BASE_TIMEOUT_MS = ACK_TIMEOUT_MS
const PUT_CONFIG_PER_KB_MS = 50
const PUT_CONFIG_MAX_TIMEOUT_MS = 60_000
const BYTES_PER_KB = 1024

/**
 * A dash instance surfaced by mDNS discovery, ready for the user to select
 * in the Connect modal. `host` is the resolved IP — IPv4 only for now,
 * since `bonjour-service` exposes both v4 and v6 and the dash binds v4 only.
 */
export interface DiscoveredDevice {
  name: string
  host: string
  port: number
  /** mDNS service name (e.g. `canshift.local.`) when present, for the UI. */
  hostname?: string
}

/** Result of a WiFi command sent to the device. Same shape as `UsbResult`. */
export interface WifiResult {
  success: boolean
  error?: string
  data?: unknown
}

/**
 * Connection-state event published on every transition. Mirrors
 * `UsbConnectionEvent` exactly — the renderer's connection-changed handler is
 * shared across transports (only the field name differs).
 */
export interface WifiConnectionEvent {
  connected: boolean
  host: string | null
  intentional: boolean
}

/**
 * Structured firmware log entry forwarded from the dash. Same shape as
 * `DeviceLogEntry` in `usb.service.ts` — the renderer's log pipeline doesn't
 * care which transport surfaced the line.
 */
export interface DeviceLogEntry {
  level: string
  tag: string
  message: string
}

/** Status snapshot consumed by the WIFI_STATUS IPC handler. */
export interface WifiStatus {
  connected: boolean
  host?: string
  port?: number
}

interface WifiEventHandlers {
  onConnectionChanged?: (event: WifiConnectionEvent) => void
  onError?: (message: string) => void
  onTelemetry?: (values: Record<string, number>) => void
  onCanFrame?: (frame: CanFrame) => void
  onCanHealth?: (health: CanHealth) => void
  onDeviceLog?: (entry: DeviceLogEntry) => void
}

interface PendingAck {
  resolve: (result: WifiResult) => void
  timer: ReturnType<typeof setTimeout>
}

/** Factory for the `Socket` constructor — overridable in tests. */
export type SocketFactory = () => Socket

/** Factory for a bonjour instance — overridable in tests. */
export type BonjourFactory = () => Bonjour

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function safeJsonParse(line: string): unknown {
  try {
    return JSON.parse(line) as unknown
  } catch {
    return null
  }
}

/** Same scaling as `putConfigTimeoutMs` in `usb.service.ts`. Exported for tests. */
export function putConfigTimeoutMs(payloadBytes: number): number {
  const sizeKB = payloadBytes / BYTES_PER_KB
  const scaled = Math.ceil(sizeKB * PUT_CONFIG_PER_KB_MS) + PUT_CONFIG_BASE_TIMEOUT_MS
  return Math.min(PUT_CONFIG_MAX_TIMEOUT_MS, Math.max(PUT_CONFIG_BASE_TIMEOUT_MS, scaled))
}

/**
 * Pick the first IPv4 address advertised by an mDNS instance. The service
 * record can list multiple addresses (one per interface, plus v6); the dash
 * binds v4 only, so we return the first v4 we find.
 */
function pickIpv4(addresses: readonly string[] | undefined): string | null {
  if (!addresses) return null
  for (const addr of addresses) {
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(addr)) return addr
  }
  return null
}

/**
 * TCP-line buffer — accumulates `Buffer` chunks and emits whole lines once a
 * `\n` is seen. Single global buffer because TCP doesn't preserve message
 * framing; the protocol's `\n` delimiter is the only frame marker we have.
 */
class LineBuffer {
  private buffer = ''

  push(chunk: Buffer | string, onLine: (line: string) => void): void {
    this.buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf-8')
    let idx = this.buffer.indexOf('\n')
    while (idx !== -1) {
      const line = this.buffer.slice(0, idx)
      this.buffer = this.buffer.slice(idx + 1)
      onLine(line)
      idx = this.buffer.indexOf('\n')
    }
  }

  reset(): void {
    this.buffer = ''
  }
}

export class WifiService {
  private socket: Socket | null = null
  private host: string | null = null
  private port: number | null = null
  private handlers: WifiEventHandlers = {}
  private pendingAck: PendingAck | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private intentionalDisconnect = false
  private lineBuffer = new LineBuffer()
  private socketFactory: SocketFactory
  private bonjourFactory: BonjourFactory

  constructor(opts?: { socketFactory?: SocketFactory; bonjourFactory?: BonjourFactory }) {
    this.socketFactory = opts?.socketFactory ?? ((): Socket => new Socket())
    this.bonjourFactory = opts?.bonjourFactory ?? ((): Bonjour => new Bonjour())
  }

  setEventHandlers(handlers: WifiEventHandlers): void {
    this.handlers = { ...handlers }
  }

  /**
   * Run an mDNS discovery sweep for ~3 s. Returns every `_canshift._tcp`
   * instance that resolved with at least one IPv4 address. Falls back to an
   * empty list on errors / no responses — the caller (renderer) surfaces the
   * manual-IP entry path in that case.
   */
  async discover(timeoutMs: number = DISCOVERY_WINDOW_MS): Promise<DiscoveredDevice[]> {
    return new Promise((resolve) => {
      const bonjour = this.bonjourFactory()
      const found = new Map<string, DiscoveredDevice>()

      const browser = bonjour.find({ type: MDNS_SERVICE_TYPE }, (service: BonjourService) => {
        const ip = pickIpv4(service.addresses)
        if (!ip) return
        const port =
          typeof service.port === 'number' && service.port > 0 ? service.port : DEFAULT_WIFI_PORT
        const key = `${ip}:${String(port)}`
        if (found.has(key)) return
        // Treat empty strings as "no value" — bonjour-service can emit an
        // empty `name` when the SRV is incomplete, and we want to fall back
        // to the hostname before defaulting to "CANShift".
        const friendly =
          (typeof service.name === 'string' && service.name.length > 0 ? service.name : null) ??
          (typeof service.host === 'string' && service.host.length > 0 ? service.host : null) ??
          'CANShift'
        const entry: DiscoveredDevice = {
          name: friendly,
          host: ip,
          port,
        }
        if (service.host) entry.hostname = service.host
        found.set(key, entry)
      })

      const finish = (): void => {
        try {
          browser.stop()
        } catch {
          // ignored — best-effort teardown
        }
        try {
          bonjour.destroy()
        } catch {
          // ignored — best-effort teardown
        }
        resolve(Array.from(found.values()))
      }

      setTimeout(finish, timeoutMs)
    })
  }

  async connect(host: string, port: number = DEFAULT_WIFI_PORT): Promise<WifiResult> {
    if (this.socket) {
      await this.disconnect()
    }
    this.intentionalDisconnect = false
    this.lineBuffer.reset()

    return new Promise((resolve) => {
      const socket = this.socketFactory()
      this.socket = socket
      socket.setNoDelay(true)

      let settled = false
      const settle = (result: WifiResult): void => {
        if (settled) return
        settled = true
        clearTimeout(connectTimer)
        resolve(result)
      }

      const connectTimer = setTimeout(() => {
        if (settled) return
        socket.destroy(new Error('Connect timeout'))
        settle({ success: false, error: 'Connect timeout' })
      }, CONNECT_TIMEOUT_MS)

      socket.once('connect', () => {
        this.host = host
        this.port = port
        this.startHeartbeat()
        this.handlers.onConnectionChanged?.({
          connected: true,
          host,
          intentional: true,
        })
        settle({ success: true })
      })

      socket.on('data', (chunk: Buffer) => {
        this.lineBuffer.push(chunk, (line) => {
          this.onLine(line)
        })
      })

      socket.on('error', (err: Error) => {
        this.handlers.onError?.(err.message)
        if (!settled) settle({ success: false, error: err.message })
      })

      socket.on('close', () => {
        const wasConnected = this.host !== null
        const intentional = this.intentionalDisconnect
        this.host = null
        this.port = null
        this.stopHeartbeat()
        this.rejectPendingAck('Connection closed')
        this.lineBuffer.reset()
        if (wasConnected) {
          this.handlers.onConnectionChanged?.({
            connected: false,
            host: null,
            intentional,
          })
        }
      })

      try {
        socket.connect({ host, port })
      } catch (err) {
        settle({
          success: false,
          error: err instanceof Error ? err.message : 'Socket connect threw',
        })
      }
    })
  }

  async disconnect(intentional = true): Promise<WifiResult> {
    this.stopHeartbeat()
    this.rejectPendingAck('Disconnecting')

    if (!this.socket) {
      this.host = null
      this.port = null
      this.intentionalDisconnect = false
      return { success: true }
    }

    this.intentionalDisconnect = intentional
    const socket = this.socket

    return new Promise((resolve) => {
      const finalize = (): void => {
        socket.removeAllListeners()
        this.socket = null
        this.host = null
        this.port = null
        this.intentionalDisconnect = false
        this.lineBuffer.reset()
        resolve({ success: true })
      }

      socket.once('close', () => {
        finalize()
      })

      try {
        socket.end()
        // Force-kill if the dash doesn't FIN within a short window.
        setTimeout(() => {
          if (this.socket === socket) socket.destroy()
        }, 500)
      } catch (err) {
        socket.destroy()
        // `close` fires after destroy() — finalize() still runs there.
        // Belt-and-suspenders: surface the underlying error if close never comes.
        setTimeout(() => {
          if (this.socket === socket) {
            finalize()
            resolve({
              success: false,
              error: err instanceof Error ? err.message : 'Socket end threw',
            })
          }
        }, 1_000)
      }
    })
  }

  isConnected(): boolean {
    return this.socket !== null && this.host !== null
  }

  getStatus(): WifiStatus {
    if (!this.isConnected() || this.host === null || this.port === null) {
      return { connected: false }
    }
    return { connected: true, host: this.host, port: this.port }
  }

  async pushConfig(config: unknown): Promise<WifiResult> {
    const payload = JSON.stringify({ cmd: 2, payload: config }) + '\n'
    const timeoutMs = putConfigTimeoutMs(Buffer.byteLength(payload, 'utf8'))
    const result = await this.sendCommand(payload, timeoutMs)
    if (result.success) {
      // Mirror USB: a push triggers a dash reboot, which drops the TCP socket.
      // Force the disconnect so the renderer sees the connected→false edge.
      void this.disconnect(false)
      return result
    }
    if (
      result.error === 'Not connected to device' ||
      result.error === 'missing_payload' ||
      result.error === 'write_failed'
    ) {
      return result
    }
    return { success: true }
  }

  async pushScreenSettings(settings: {
    brightness: number
    sleep: number
    rotation?: 0 | 180
  }): Promise<WifiResult> {
    const payload = JSON.stringify({ cmd: 0x05, ...settings }) + '\n'
    return this.sendCommand(payload)
  }

  async queryVersion(): Promise<{ version: string | null; isDay: boolean | null }> {
    const payload = JSON.stringify({ cmd: 0x10 }) + '\n'
    const result = await this.sendCommand(payload, 4_000)
    if (!result.success || !isRecord(result.data)) {
      return { version: null, isDay: null }
    }
    const v = result.data.version
    const isDayRaw = result.data.is_day
    return {
      version: typeof v === 'string' ? v : null,
      isDay: isDayRaw === 1 ? true : isDayRaw === 0 ? false : null,
    }
  }

  async getConfig(): Promise<DeviceConfigResult> {
    const payload = JSON.stringify({ cmd: 0x01 }) + '\n'
    const result = await this.sendCommand(payload, 8_000)
    if (result.success) {
      if (!isRecord(result.data)) return { ok: false, reason: 'transport' }
      const cfg = result.data.config
      return isRecord(cfg) ? { ok: true, config: cfg } : { ok: false, reason: 'transport' }
    }
    if (result.error === 'config_not_found') return { ok: false, reason: 'no-config' }
    return { ok: false, reason: 'transport' }
  }

  async toggleDayNight(): Promise<WifiResult> {
    const payload = JSON.stringify({ cmd: 0x07 }) + '\n'
    return this.sendCommand(payload)
  }

  async setDayNight(day: boolean): Promise<WifiResult> {
    const payload = JSON.stringify({ cmd: 0x09, day }) + '\n'
    return this.sendCommand(payload)
  }

  async calibrateTouch(): Promise<WifiResult> {
    const payload = JSON.stringify({ cmd: 0x08 }) + '\n'
    return this.sendCommand(payload)
  }

  async startCanScan(): Promise<WifiResult> {
    const payload = JSON.stringify({ cmd: 0x20 }) + '\n'
    return this.sendCommand(payload)
  }

  async stopCanScan(): Promise<WifiResult> {
    const payload = JSON.stringify({ cmd: 0x21 }) + '\n'
    return this.sendCommand(payload)
  }

  async rebootDevice(): Promise<WifiResult> {
    if (!this.isConnected()) {
      return { success: false, error: 'Not connected to device' }
    }
    const payload = JSON.stringify({ cmd: 0xf0 }) + '\n'
    return new Promise((resolve) => {
      this.socket?.write(payload, (err) => {
        if (err) {
          resolve({ success: false, error: err.message })
        } else {
          resolve({ success: true })
        }
      })
    })
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (!this.isConnected()) return
      this.socket?.write('\n', (err) => {
        if (err) {
          this.handlers.onError?.(`heartbeat: ${err.message}`)
          void this.disconnect(false)
        }
      })
    }, HEARTBEAT_INTERVAL_MS)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private rejectPendingAck(reason: string): void {
    if (!this.pendingAck) return
    const ack = this.pendingAck
    this.pendingAck = null
    clearTimeout(ack.timer)
    ack.resolve({ success: false, error: reason })
  }

  private sendCommand(payload: string, timeoutMs: number = ACK_TIMEOUT_MS): Promise<WifiResult> {
    if (!this.isConnected()) {
      return Promise.resolve({ success: false, error: 'Not connected to device' })
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingAck = null
        resolve({ success: false, error: 'Device did not acknowledge (timeout)' })
      }, timeoutMs)

      this.pendingAck = { resolve, timer }

      this.socket?.write(payload, (err) => {
        if (err) {
          clearTimeout(timer)
          this.pendingAck = null
          resolve({ success: false, error: err.message })
        }
      })
    })
  }

  private onLine(line: string): void {
    const trimmed = line.trim()
    if (!trimmed) return

    const parsed = safeJsonParse(trimmed)
    if (!isRecord(parsed)) return

    if ('tele' in parsed) {
      const values = (parsed as { v?: unknown }).v
      if (isRecord(values)) {
        const flat: Record<string, number> = {}
        for (const [k, v] of Object.entries(values)) {
          if (typeof v === 'number') flat[k] = v
        }
        this.handlers.onTelemetry?.(flat)
      }
      return
    }

    if ('can_stat' in parsed) {
      const s = parsed as { fps?: unknown; errors?: unknown }
      const fps = typeof s.fps === 'number' ? s.fps : 0
      const errors = typeof s.errors === 'number' ? s.errors : 0
      this.handlers.onCanHealth?.({ fps, errors })
      return
    }

    if ('can' in parsed) {
      const f = parsed as { id?: unknown; len?: unknown; d?: unknown }
      if (typeof f.id === 'number' && typeof f.len === 'number' && Array.isArray(f.d)) {
        const data = (f.d as unknown[]).filter((b): b is number => typeof b === 'number')
        this.handlers.onCanFrame?.({ id: f.id, len: f.len, data })
      }
      return
    }

    if ('log' in parsed) {
      const e = parsed as { lvl?: unknown; tag?: unknown; msg?: unknown }
      this.handlers.onDeviceLog?.({
        level: typeof e.lvl === 'string' ? e.lvl : 'I',
        tag: typeof e.tag === 'string' ? e.tag : '',
        message: typeof e.msg === 'string' ? e.msg : '',
      })
      return
    }

    if (this.pendingAck) {
      const ack = this.pendingAck
      this.pendingAck = null
      clearTimeout(ack.timer)

      const r = parsed as { status?: string; message?: string }
      if (r.status === 'ok') {
        ack.resolve({ success: true, data: parsed })
      } else {
        ack.resolve({ success: false, error: r.message ?? 'Device returned error' })
      }
    }
  }
}

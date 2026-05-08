// usb.service.ts — USB serial communication with CANShift firmware
//
// Protocol: JSON lines at 115200 baud.
// Commands: desktop → device, one JSON object per line ending with \n.
// Responses: device → desktop, {"status":"ok"} or {"status":"error",...}
// Telemetry: device → desktop proactively, {"tele":1,"v":{"rpm":...}}
//
// A single persistent data listener dispatches incoming lines:
//   - lines with "tele" field → telemetry handler (→ renderer via USB_DATA_RECEIVED)
//   - all other lines → pending command ack resolver (one at a time)

import { SerialPort } from 'serialport'
import { ReadlineParser } from '@serialport/parser-readline'
import type { ConnectionStatus, PortInfo, UsbResult } from '@tmbk/canshift-core'

export interface CanFrame {
  id: number
  len: number
  data: number[]
}

export interface CanHealth {
  fps: number
  errors: number
}

/**
 * Structured log entry forwarded from the firmware.
 * Wire format: {"log":1,"lvl":"E|W|I|D|V","tag":"...","msg":"..."}
 */
export interface DeviceLogEntry {
  level: string
  tag: string
  message: string
}

interface UsbEventHandlers {
  onConnectionChanged?: (status: ConnectionStatus) => void
  onError?: (message: string) => void
  onTelemetry?: (values: Record<string, number>) => void
  onCanFrame?: (frame: CanFrame) => void
  onCanHealth?: (health: CanHealth) => void
  onDeviceLog?: (entry: DeviceLogEntry) => void
}

interface PendingAck {
  resolve: (result: UsbResult) => void
  timer: ReturnType<typeof setTimeout>
}

const ACK_TIMEOUT_MS = 5_000

// CMD_PUT_CONFIG ack scaling — the firmware writes the full JSON to SD
// synchronously before acking, so a slow CH340 link plus a slow SD card can
// easily exceed the default 5 s ack window for 5+ KB configs (issue #217).
// Add a generous per-KB margin on top of the base timeout, and cap the total
// so a runaway payload can't hang the UI indefinitely.
const PUT_CONFIG_BASE_TIMEOUT_MS = ACK_TIMEOUT_MS
const PUT_CONFIG_PER_KB_MS = 50
const PUT_CONFIG_MAX_TIMEOUT_MS = 60_000

// Heartbeat: a single \n every 2s while connected. The firmware updates its
// "host active" timer on any byte received, but a bare \n produces no command
// (rxPos=0 → no handleCommand call) so it doesn't pollute the response stream
// or interfere with pending acks. Drives the top-bar USB icon (issue #53).
const HEARTBEAT_INTERVAL_MS = 2_000

// CMD_PUT_FILE chunking. 2 KB raw → ~2.7 KB base64 → ~2.9 KB JSON line, well
// below the firmware's 6.4 KB receive buffer. Each chunk is acked individually
// so a 76 KB asset takes ~38 round-trips at 115 200 baud (~10 s end-to-end).
const PUT_FILE_CHUNK_SIZE = 2048
// CMD_PUT_FILE acks come back fast — 1 s is generous on a healthy link.
const PUT_FILE_CHUNK_TIMEOUT_MS = 5_000

const BYTES_PER_KB = 1024

/**
 * Compute the ack timeout for CMD_PUT_CONFIG given the wire payload length in
 * bytes. Scales linearly with size, clamped to [base, max]. Exported for tests.
 */
export function putConfigTimeoutMs(payloadBytes: number): number {
  const sizeKB = payloadBytes / BYTES_PER_KB
  const scaled = Math.ceil(sizeKB * PUT_CONFIG_PER_KB_MS) + PUT_CONFIG_BASE_TIMEOUT_MS
  return Math.min(PUT_CONFIG_MAX_TIMEOUT_MS, Math.max(PUT_CONFIG_BASE_TIMEOUT_MS, scaled))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Runtime SD-card state reported by CMD_GET_STATUS.
 *
 * - 'ok'             — SD mounted, persistent writes work.
 * - 'no_card'        — no card inserted, device is on built-in defaults.
 * - 'mount_failed'   — card present but unreadable, defaults active.
 * - 'unknown'        — older firmware that doesn't include `sd_state` in its
 *                      status response. Treat as best-effort OK so the UI
 *                      doesn't regress on devices we haven't reflashed yet.
 */
export type SdRuntimeState = 'ok' | 'no_card' | 'mount_failed' | 'unknown'

/**
 * Parse the additive `sd` / `sd_state` fields from a CMD_GET_STATUS response.
 *
 * The `sd_state` string is the source of truth on current firmware. We fall
 * back to `sd === 0` (degraded, exact failure mode unknown) for the brief
 * window where firmware shipped `sd` without `sd_state`. Pre-#201 firmware
 * that ships neither field maps to 'unknown' so the renderer can keep the
 * existing UX (no warning, all actions enabled).
 */
export function parseSdState(response: Record<string, unknown>): SdRuntimeState {
  const stateRaw = response.sd_state
  if (typeof stateRaw === 'string') {
    if (stateRaw === 'ok' || stateRaw === 'no_card' || stateRaw === 'mount_failed') {
      return stateRaw
    }
    // Unrecognised string from a future firmware revision — treat conservatively
    // as a known degraded state so config writes are blocked, not silently lost.
    return 'mount_failed'
  }
  const sdRaw = response.sd
  if (sdRaw === 0) return 'mount_failed'
  if (sdRaw === 1) return 'ok'
  return 'unknown'
}

function safeJsonParse(line: string): unknown {
  try {
    return JSON.parse(line) as unknown
  } catch {
    return null
  }
}

export class UsbService {
  private port: SerialPort | null = null
  private parser: ReadlineParser | null = null
  private portPath: string | null = null
  private handlers: UsbEventHandlers = {}
  private pendingAck: PendingAck | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  // True while a voluntary disconnect is in flight. The 'close' listener uses
  // it to suppress the onConnectionChanged event so the UI doesn't log a
  // spurious "disconnected unexpectedly" entry on a user-initiated disconnect.
  private intentionalDisconnect = false

  setEventHandlers(handlers: UsbEventHandlers): void {
    this.handlers = { ...handlers }
  }

  async listPorts(): Promise<PortInfo[]> {
    const ports = await SerialPort.list()
    return ports.map((p) => ({
      path: p.path,
      manufacturer: p.manufacturer,
      serialNumber: p.serialNumber,
      vendorId: p.vendorId,
      productId: p.productId,
    }))
  }

  async connect(portPath: string): Promise<UsbResult> {
    if (this.port?.isOpen) {
      await this.disconnect()
    }
    this.intentionalDisconnect = false

    return new Promise((resolve) => {
      this.port = new SerialPort({
        path: portPath,
        baudRate: 115200,
        autoOpen: false,
      })

      this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }))

      // Single persistent dispatcher — routes all incoming lines
      this.parser.on('data', (line: string) => {
        this.onData(line)
      })

      this.port.on('close', () => {
        const wasConnected = this.portPath !== null
        this.portPath = null
        this.stopHeartbeat()
        this.rejectPendingAck('Connection closed')
        if (wasConnected && !this.intentionalDisconnect) {
          this.handlers.onConnectionChanged?.({ connected: false })
        }
      })

      this.port.on('error', (err: Error) => {
        this.handlers.onError?.(err.message)
      })

      this.port.open((err) => {
        if (err) {
          resolve({ success: false, error: err.message })
          return
        }
        this.portPath = portPath
        this.startHeartbeat()
        this.handlers.onConnectionChanged?.({ connected: true, portPath })
        resolve({ success: true })
      })
    })
  }

  /**
   * Close the serial port and reset all connection state.
   *
   * @param intentional `true` (default) when triggered by the user or another
   *   voluntary code path — suppresses the onConnectionChanged event so the
   *   renderer's "disconnected unexpectedly" log doesn't fire. Pass `false`
   *   from involuntary paths (heartbeat unplug, write failure) so the UI is
   *   notified.
   */
  async disconnect(intentional = true): Promise<UsbResult> {
    this.stopHeartbeat()
    this.rejectPendingAck('Disconnecting')

    if (!this.port?.isOpen) {
      this.portPath = null
      this.port = null
      this.parser = null
      this.intentionalDisconnect = false
      return { success: true }
    }

    this.intentionalDisconnect = intentional
    const port = this.port
    const parser = this.parser

    // Detach the read pipeline before close so no late `data` events run on
    // a half-torn-down state.
    if (parser) {
      parser.removeAllListeners()
      port.unpipe(parser)
    }

    return new Promise((resolve) => {
      port.close((err) => {
        port.removeAllListeners()
        this.port = null
        this.parser = null
        this.portPath = null
        this.intentionalDisconnect = false
        if (err) {
          resolve({ success: false, error: err.message })
        } else {
          resolve({ success: true })
        }
      })
    })
  }

  async pushConfig(config: unknown): Promise<UsbResult> {
    const payload = JSON.stringify({ cmd: 2, payload: config }) + '\n'
    // Firmware writes to SD synchronously before acking — scale with size.
    const timeoutMs = putConfigTimeoutMs(Buffer.byteLength(payload, 'utf8'))
    return this.sendCommand(payload, timeoutMs)
  }

  async pushScreenSettings(settings: {
    brightness: number
    sleep: number
    rotation?: 0 | 180
  }): Promise<UsbResult> {
    // CMD_SCREEN_SETTINGS = 0x05 — `rotation` is optional; sending a value
    // different from the device's current setting triggers a reboot.
    const payload = JSON.stringify({ cmd: 0x05, ...settings }) + '\n'
    return this.sendCommand(payload)
  }

  /**
   * Query the device firmware version + day/night state + SD card state.
   * Returns { version: null } on timeout (device has no CANShift firmware,
   * or pre-v0.2 firmware without CMD_GET_STATUS support).
   * `isDay` is null on firmware older than 0.7.0 which didn't expose it.
   * `sdState` is 'unknown' on firmware older than the issue #201/#254/#269
   * batch which didn't expose `sd_state`. Treat 'unknown' as best-effort OK
   * to keep the older-firmware UX intact.
   */
  async queryVersion(): Promise<{
    version: string | null
    isDay: boolean | null
    sdState: SdRuntimeState
  }> {
    // CMD_GET_STATUS = 0x10 — response (current firmware):
    //   {"status":"ok","version":"x.y.z","protocol":N,"is_day":0|1,
    //    "sd":0|1,"sd_state":"ok"|"no_card"|"mount_failed"}
    const payload = JSON.stringify({ cmd: 0x10 }) + '\n'
    const result = await this.sendCommand(payload, 2_000) // shorter timeout for probe
    if (!result.success || !result.data) {
      return { version: null, isDay: null, sdState: 'unknown' }
    }
    const v = result.data.version
    const isDayRaw = result.data.is_day
    return {
      version: typeof v === 'string' ? v : null,
      isDay: isDayRaw === 1 ? true : isDayRaw === 0 ? false : null,
      sdState: parseSdState(result.data),
    }
  }

  /**
   * Read the current dashboard.json content from the device's SD card.
   * Returns null on any failure (firmware too old, missing file, parse error)
   * — caller decides whether to fall back to local state.
   */
  async getConfig(): Promise<Record<string, unknown> | null> {
    // CMD_GET_CONFIG = 0x01 — response:
    //   {"status":"ok","config":{...}}  on success (whole dashboard.json)
    //   {"status":"error","message":"config_not_found"} when the file is missing
    const payload = JSON.stringify({ cmd: 0x01 }) + '\n'
    // The full dashboard.json can run > 10 KB; allow extra read time so the
    // ReadlineParser has the whole frame before the ack timer fires.
    const result = await this.sendCommand(payload, 8_000)
    if (!result.success || !result.data) return null
    const cfg = result.data.config
    return isRecord(cfg) ? cfg : null
  }

  async toggleDayNight(): Promise<UsbResult> {
    // CMD_TOGGLE_DAY_NIGHT = 0x07
    const payload = JSON.stringify({ cmd: 0x07 }) + '\n'
    return this.sendCommand(payload)
  }

  async setDayNight(day: boolean): Promise<UsbResult> {
    // CMD_SET_DAY_NIGHT = 0x09 — explicit, idempotent variant of toggleDayNight.
    // Older firmware (no handler) will respond with the default {"status":"ok"}
    // ack and no theme change; the caller can fall back to toggleDayNight when
    // desired by checking the device's reported is_day after a status refresh.
    const payload = JSON.stringify({ cmd: 0x09, day }) + '\n'
    return this.sendCommand(payload)
  }

  async calibrateTouch(): Promise<UsbResult> {
    // CMD_CALIBRATE_TOUCH = 0x08 — fires the on-device crosshair flow.
    // The firmware acks immediately and runs the blocking calibration on the UI task.
    const payload = JSON.stringify({ cmd: 0x08 }) + '\n'
    return this.sendCommand(payload)
  }

  async startCanScan(): Promise<UsbResult> {
    const payload = JSON.stringify({ cmd: 0x20 }) + '\n'
    return this.sendCommand(payload)
  }

  async stopCanScan(): Promise<UsbResult> {
    const payload = JSON.stringify({ cmd: 0x21 }) + '\n'
    return this.sendCommand(payload)
  }

  /**
   * Stream a file to the SD card over USB in base64-encoded chunks.
   * Each chunk is acked by the firmware before the next is sent — so a slow
   * SD write or a stalled link can't run ahead of the device.
   *
   * @param devicePath absolute path on the SD ("/assets/icon_day.bin")
   * @param content    file bytes to write
   */
  async pushFile(devicePath: string, content: Buffer): Promise<UsbResult> {
    if (!this.port?.isOpen) {
      return { success: false, error: 'Not connected to device' }
    }
    if (!devicePath.startsWith('/')) {
      return { success: false, error: `Invalid device path: ${devicePath}` }
    }

    const totalChunks = Math.max(1, Math.ceil(content.length / PUT_FILE_CHUNK_SIZE))

    for (let idx = 0; idx < totalChunks; idx++) {
      const start = idx * PUT_FILE_CHUNK_SIZE
      const end = Math.min(start + PUT_FILE_CHUNK_SIZE, content.length)
      const chunk = content.subarray(start, end)
      const payload =
        JSON.stringify({
          cmd: 0x06,
          path: devicePath,
          total: totalChunks,
          idx,
          data: chunk.toString('base64'),
        }) + '\n'

      const ack = await this.sendCommand(payload, PUT_FILE_CHUNK_TIMEOUT_MS)
      if (!ack.success) {
        return {
          success: false,
          error: `chunk ${String(idx + 1)}/${String(totalChunks)} of ${devicePath}: ${ack.error ?? 'unknown error'}`,
        }
      }
    }

    return { success: true }
  }

  async rebootDevice(): Promise<UsbResult> {
    if (!this.port?.isOpen) {
      return { success: false, error: 'Not connected to device' }
    }

    const payload = JSON.stringify({ cmd: 0xf0 }) + '\n'
    return new Promise((resolve) => {
      this.port?.write(payload, (err) => {
        if (err) {
          resolve({ success: false, error: err.message })
        } else {
          resolve({ success: true })
        }
      })
    })
  }

  getStatus(): ConnectionStatus {
    const status: ConnectionStatus = { connected: this.port?.isOpen ?? false }
    if (this.portPath) status.portPath = this.portPath
    return status
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      void this.heartbeatTick()
    }, HEARTBEAT_INTERVAL_MS)
  }

  // One heartbeat round: writes a bare \n and confirms the port still exists
  // in the OS port list. Either failing condition forces a disconnect so the
  // UI transitions out of "connected" within HEARTBEAT_INTERVAL_MS instead of
  // waiting for the next user-initiated command to time out (issue #107).
  private async heartbeatTick(): Promise<void> {
    if (!this.port?.isOpen || !this.portPath) return

    // Quick port-list sanity check — catches the unplug case on platforms
    // where Node SerialPort doesn't surface the close event promptly.
    try {
      const ports = await SerialPort.list()
      const stillPresent = ports.some((p) => p.path === this.portPath)
      if (!stillPresent) {
        this.handlers.onError?.('Device unplugged')
        await this.disconnect(false)
        return
      }
    } catch {
      // SerialPort.list failures are non-fatal — heartbeat continues
    }

    // Bare \n: firmware updates s_lastHostCmdMs on the byte but s_rxPos stays
    // 0 → no command parsed, no response sent, no pendingAck collision.
    this.port.write('\n', (err) => {
      if (err) {
        this.handlers.onError?.(`heartbeat: ${err.message}`)
        void this.disconnect(false)
      }
    })
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

  /**
   * Send a command line and wait for the firmware ack.
   * At most one command is in-flight at a time — concurrent callers wait.
   * Pass a custom timeoutMs for commands that probe for device presence (e.g. queryVersion).
   */
  private sendCommand(payload: string, timeoutMs: number = ACK_TIMEOUT_MS): Promise<UsbResult> {
    if (!this.port?.isOpen) {
      return Promise.resolve({ success: false, error: 'Not connected to device' })
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingAck = null
        resolve({ success: false, error: 'Device did not acknowledge (timeout)' })
      }, timeoutMs)

      this.pendingAck = { resolve, timer }

      this.port?.write(payload, (err) => {
        if (err) {
          clearTimeout(timer)
          this.pendingAck = null
          resolve({ success: false, error: err.message })
        }
      })
    })
  }

  /**
   * Dispatch an incoming line from the firmware.
   * Telemetry lines go to the telemetry handler.
   * Everything else resolves the pending command ack.
   */
  private onData(line: string): void {
    const trimmed = line.trim()
    if (!trimmed) return

    const parsed = safeJsonParse(trimmed)
    if (!isRecord(parsed)) return

    // Telemetry push — field "tele" present
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

    // CAN health stats — field "can_stat" present
    // Format: {"can_stat":1,"fps":12.5,"errors":0}
    if ('can_stat' in parsed) {
      const s = parsed as { fps?: unknown; errors?: unknown }
      const fps = typeof s.fps === 'number' ? s.fps : 0
      const errors = typeof s.errors === 'number' ? s.errors : 0
      this.handlers.onCanHealth?.({ fps, errors })
      return
    }

    // CAN scan frame — field "can" present
    // Format: {"can":1,"id":<n>,"len":<n>,"d":[...]}
    if ('can' in parsed) {
      const f = parsed as { id?: unknown; len?: unknown; d?: unknown }
      if (typeof f.id === 'number' && typeof f.len === 'number' && Array.isArray(f.d)) {
        const data = (f.d as unknown[]).filter((b): b is number => typeof b === 'number')
        this.handlers.onCanFrame?.({ id: f.id, len: f.len, data })
      }
      return
    }

    // Device log line — field "log" present
    // Format: {"log":1,"lvl":"E|W|I|D|V","tag":"...","msg":"..."}
    // Must be checked BEFORE the command-ack fallthrough so a logger emit from
    // the firmware can never accidentally resolve a pending command.
    if ('log' in parsed) {
      const e = parsed as { lvl?: unknown; tag?: unknown; msg?: unknown }
      this.handlers.onDeviceLog?.({
        level: typeof e.lvl === 'string' ? e.lvl : 'I',
        tag: typeof e.tag === 'string' ? e.tag : '',
        message: typeof e.msg === 'string' ? e.msg : '',
      })
      return
    }

    // Command response — resolve pending ack
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

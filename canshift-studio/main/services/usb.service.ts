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

interface PortInfo {
  path: string
  manufacturer?: string
  serialNumber?: string
  vendorId?: string
  productId?: string
}

interface ConnectionStatus {
  connected: boolean
  portPath?: string
}

interface UsbResult {
  success: boolean
  error?: string
  /** Full parsed JSON response from the device (for commands that return extra fields). */
  data?: Record<string, unknown>
}

export interface CanFrame {
  id: number
  len: number
  data: number[]
}

export interface CanHealth {
  fps: number
  errors: number
}

interface UsbEventHandlers {
  onConnectionChanged?: (status: ConnectionStatus) => void
  onError?: (message: string) => void
  onTelemetry?: (values: Record<string, number>) => void
  onCanFrame?: (frame: CanFrame) => void
  onCanHealth?: (health: CanHealth) => void
}

interface PendingAck {
  resolve: (result: UsbResult) => void
  timer: ReturnType<typeof setTimeout>
}

const ACK_TIMEOUT_MS = 5_000

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

export class UsbService {
  private port: SerialPort | null = null
  private parser: ReadlineParser | null = null
  private portPath: string | null = null
  private handlers: UsbEventHandlers = {}
  private pendingAck: PendingAck | null = null

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
        if (wasConnected) {
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
        this.handlers.onConnectionChanged?.({ connected: true, portPath })
        resolve({ success: true })
      })
    })
  }

  async disconnect(): Promise<UsbResult> {
    if (!this.port?.isOpen) {
      this.portPath = null
      return { success: true }
    }

    return new Promise((resolve) => {
      this.port?.close((err) => {
        this.port = null
        this.parser = null
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
    return this.sendCommand(payload)
  }

  async pushScreenSettings(settings: {
    brightness: number
    contrast: number
    sleep: number
    rotation: number
  }): Promise<UsbResult> {
    // CMD_SCREEN_SETTINGS = 0x05
    const payload = JSON.stringify({ cmd: 0x05, ...settings }) + '\n'
    return this.sendCommand(payload)
  }

  /**
   * Query the device firmware version.
   * Returns { version: string } if the device responds, or { version: null } on timeout
   * (device has no CANShift firmware, or pre-v0.2 firmware without CMD_GET_STATUS support).
   */
  async queryVersion(): Promise<{ version: string | null }> {
    // CMD_GET_STATUS = 0x10 — response: {"status":"ok","version":"x.y.z","protocol":N}
    const payload = JSON.stringify({ cmd: 0x10 }) + '\n'
    const result = await this.sendCommand(payload, 2_000) // shorter timeout for probe
    if (!result.success || !result.data) return { version: null }
    const v = result.data.version
    return { version: typeof v === 'string' ? v : null }
  }

  async startCanScan(): Promise<UsbResult> {
    const payload = JSON.stringify({ cmd: 0x20 }) + '\n'
    return this.sendCommand(payload)
  }

  async stopCanScan(): Promise<UsbResult> {
    const payload = JSON.stringify({ cmd: 0x21 }) + '\n'
    return this.sendCommand(payload)
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

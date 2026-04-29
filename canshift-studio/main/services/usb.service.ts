// usb.service.ts — USB serial communication with CANShift firmware
//
// Phase 1 protocol: JSON-framed commands over USB serial (115200 baud).
// Each command is a JSON object followed by \n.
// Each response is a JSON object followed by \n.
//
// TODO: Implement binary framing protocol (see dash-firmware/src/hal/usb/usb_comm.h)
//       once both sides converge on the final protocol spec.

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
  firmwareVersion?: string
  uptime?: number
}

interface UsbResult {
  success: boolean
  error?: string
  data?: unknown
}

interface UsbEventHandlers {
  onConnectionChanged?: (status: ConnectionStatus) => void
  onError?: (message: string) => void
}

// Timeout in ms to wait for RSP_OK after pushConfig
const PUSH_ACK_TIMEOUT_MS = 5_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export class UsbService {
  private port: SerialPort | null = null
  private parser: ReadlineParser | null = null
  private portPath: string | null = null
  private handlers: UsbEventHandlers = {}

  setEventHandlers(handlers: UsbEventHandlers): void {
    this.handlers = handlers
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

      // Detect unexpected disconnects (cable pulled, device reset)
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
        // 'close' event above will fire and notify the renderer
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
    if (!this.port?.isOpen || !this.parser) {
      return { success: false, error: 'Not connected to device' }
    }

    const payload = JSON.stringify({ cmd: 2, payload: config }) + '\n'

    return new Promise((resolve) => {
      if (!this.parser || !this.port?.isOpen) {
        resolve({ success: false, error: 'Not connected to device' })
        return
      }

      const parser = this.parser

      const onAck = (line: string) => {
        clearTimeout(timer)
        try {
          const resp = JSON.parse(line) as unknown
          if (isRecord(resp) && resp.status === 'ok') {
            resolve({ success: true })
          } else {
            const msg =
              isRecord(resp) && typeof resp.message === 'string'
                ? resp.message
                : 'Device returned error'
            resolve({ success: false, error: msg })
          }
        } catch {
          resolve({ success: false, error: 'Invalid response from device' })
        }
      }

      const timer = setTimeout(() => {
        parser.removeListener('data', onAck)
        resolve({ success: false, error: 'Device did not acknowledge (timeout)' })
      }, PUSH_ACK_TIMEOUT_MS)

      parser.once('data', onAck)

      this.port.write(payload, (err) => {
        if (err) {
          clearTimeout(timer)
          parser.removeListener('data', onAck)
          resolve({ success: false, error: err.message })
        }
      })
    })
  }

  getStatus(): ConnectionStatus {
    return {
      connected: this.port?.isOpen ?? false,
      portPath: this.portPath ?? undefined,
    }
  }

  async pushScreenSettings(settings: {
    brightness: number
    contrast: number
    sleep: number
    rotation: number
  }): Promise<UsbResult> {
    if (!this.port?.isOpen) {
      return { success: false, error: 'Not connected to device' }
    }

    // CMD_SCREEN_SETTINGS = 0x05
    const payload = JSON.stringify({ cmd: 0x05, ...settings }) + '\n'

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve({ success: false, error: 'Device did not acknowledge (timeout)' })
      }, PUSH_ACK_TIMEOUT_MS)

      this.port?.write(payload, (err) => {
        clearTimeout(timer)
        if (err) {
          resolve({ success: false, error: err.message })
        } else {
          resolve({ success: true })
        }
      })
    })
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
}

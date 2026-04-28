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

export class UsbService {
  private port: SerialPort | null = null
  private parser: ReadlineParser | null = null
  private portPath: string | null = null

  async listPorts(): Promise<PortInfo[]> {
    const ports = await SerialPort.list()
    return ports.map((p) => ({
      path:         p.path,
      manufacturer: p.manufacturer,
      serialNumber: p.serialNumber,
      vendorId:     p.vendorId,
      productId:    p.productId,
    }))
  }

  async connect(portPath: string): Promise<UsbResult> {
    if (this.port?.isOpen) {
      await this.disconnect()
    }

    return new Promise((resolve) => {
      this.port = new SerialPort({
        path:     portPath,
        baudRate: 115200,
        autoOpen: false,
      })

      this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }))

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
      return { success: true }
    }

    return new Promise((resolve) => {
      this.port?.close((err) => {
        this.port     = null
        this.parser   = null
        this.portPath = null
        if (err) {
          resolve({ success: false, error: err.message })
        } else {
          resolve({ success: true })
        }
      })
    })
  }

  async pushConfig(config: unknown): Promise<UsbResult> {
    if (!this.port?.isOpen) {
      return { success: false, error: 'Not connected to device' }
    }

    // TODO: Implement actual protocol — for now, write JSON + newline
    const payload = JSON.stringify({ cmd: 2, payload: config }) + '\n'

    return new Promise((resolve) => {
      this.port?.write(payload, (err) => {
        if (err) {
          resolve({ success: false, error: err.message })
        } else {
          // TODO: Wait for RSP_OK response from device
          resolve({ success: true })
        }
      })
    })
  }

  async getStatus(): Promise<ConnectionStatus> {
    return {
      connected:  this.port?.isOpen ?? false,
      portPath:   this.portPath ?? undefined,
    }
  }

  async rebootDevice(): Promise<UsbResult> {
    if (!this.port?.isOpen) {
      return { success: false, error: 'Not connected to device' }
    }

    const payload = JSON.stringify({ cmd: 0xF0 }) + '\n'
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

// usb.service.test.ts — Regression coverage for the USB disconnect bookkeeping.
//
// Locks the contract from PR #148 (issue #139): voluntary disconnects must NOT
// surface a phantom "disconnected unexpectedly" event, while involuntary ones
// (heartbeat unplug, write failure) must.
//
// @vitest-environment node

import { EventEmitter } from 'node:events'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Fakes — minimal SerialPort / ReadlineParser surface used by usb.service.ts
//
// Defined inside vi.hoisted() so the vi.mock factories below can reference
// them safely (vi.mock is hoisted to the top of the file).
// ---------------------------------------------------------------------------

const fakes = vi.hoisted(() => {
  // Re-import inside the hoisted block — it runs before module-level imports.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter } = require('node:events') as typeof import('node:events')

  class FakeSerialPort extends EventEmitter {
    static instances: FakeSerialPort[] = []
    static listResult: { path: string }[] = []
    static list = (): Promise<{ path: string }[]> => Promise.resolve(FakeSerialPort.listResult)

    path: string
    isOpen = false

    constructor(opts: { path: string; baudRate: number; autoOpen: boolean }) {
      super()
      this.path = opts.path
      FakeSerialPort.instances.push(this)
    }

    pipe<T>(parser: T): T {
      return parser
    }

    unpipe(_parser: unknown): void {
      /* no-op */
    }

    open(cb: (err?: Error) => void): void {
      this.isOpen = true
      cb()
    }

    close(cb?: (err?: Error) => void): void {
      this.isOpen = false
      // Real serialport emits 'close' synchronously, then runs the callback —
      // mirror that order so the close-event handler runs before disconnect()
      // tears down listeners.
      this.emit('close')
      cb?.()
    }

    write(_data: string, cb?: (err?: Error | null) => void): void {
      cb?.(null)
    }
  }

  class FakeReadlineParser extends EventEmitter {
    constructor(_opts: { delimiter: string }) {
      super()
    }
  }

  return { FakeSerialPort, FakeReadlineParser }
})

vi.mock('serialport', () => ({ SerialPort: fakes.FakeSerialPort }))
vi.mock('@serialport/parser-readline', () => ({ ReadlineParser: fakes.FakeReadlineParser }))

import { UsbService } from './usb.service'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UsbService — disconnect bookkeeping (regression for #139 / #148)', () => {
  beforeEach(() => {
    fakes.FakeSerialPort.instances.length = 0
    fakes.FakeSerialPort.listResult = [{ path: '/dev/tty.test' }]
  })

  it('disconnect() with no active port resolves success without firing handlers', async () => {
    const service = new UsbService()
    const onConnectionChanged = vi.fn()
    const onError = vi.fn()
    service.setEventHandlers({ onConnectionChanged, onError })

    const result = await service.disconnect()

    expect(result.success).toBe(true)
    expect(onConnectionChanged).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('intentional disconnect closes the port without firing onConnectionChanged', async () => {
    const service = new UsbService()
    const onConnectionChanged = vi.fn()
    service.setEventHandlers({ onConnectionChanged })

    const connectResult = await service.connect('/dev/tty.test')
    expect(connectResult.success).toBe(true)
    expect(onConnectionChanged).toHaveBeenCalledWith({
      connected: true,
      portPath: '/dev/tty.test',
    })
    onConnectionChanged.mockClear()

    const disconnectResult = await service.disconnect()

    expect(disconnectResult.success).toBe(true)
    // The 'close' event fired but the user-initiated disconnect must suppress
    // the renderer notification — otherwise the UI logs a phantom unplug.
    expect(onConnectionChanged).not.toHaveBeenCalled()
    expect(service.getStatus()).toEqual({ connected: false })
  })

  it('involuntary disconnect (intentional=false) does fire onConnectionChanged', async () => {
    const service = new UsbService()
    const onConnectionChanged = vi.fn()
    service.setEventHandlers({ onConnectionChanged })

    await service.connect('/dev/tty.test')
    onConnectionChanged.mockClear()

    const disconnectResult = await service.disconnect(false)

    expect(disconnectResult.success).toBe(true)
    expect(onConnectionChanged).toHaveBeenCalledWith({ connected: false })
  })

  it('a fresh connect after disconnect resets the intentional flag', async () => {
    // Regression guard: if intentionalDisconnect leaks across sessions, an
    // unplug right after a fresh connect would silently swallow the event.
    const service = new UsbService()
    const onConnectionChanged = vi.fn()
    service.setEventHandlers({ onConnectionChanged })

    await service.connect('/dev/tty.test')
    await service.disconnect() // intentional — flag set then cleared
    onConnectionChanged.mockClear()

    await service.connect('/dev/tty.test')
    onConnectionChanged.mockClear()

    // Simulate the OS-level close (e.g. unplug) — close event fires from the
    // port directly, NOT through service.disconnect()
    const port = fakes.FakeSerialPort.instances[fakes.FakeSerialPort.instances.length - 1]
    expect(port).toBeDefined()
    port?.emit('close')

    expect(onConnectionChanged).toHaveBeenCalledWith({ connected: false })
  })
})

// Keep an unused import to silence noUnusedLocals if it ever turns on for tests
void EventEmitter

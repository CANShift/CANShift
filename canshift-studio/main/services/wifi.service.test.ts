// wifi.service.test.ts — WiFi TCP transport regression coverage.
//
// Locks the contracts that keep the WiFi path interchangeable with the USB
// path (issue #1071):
//   - connect / disconnect publish the same connection-changed events as USB
//     (mirroring the #696 single-source-of-truth pattern).
//   - the TCP byte stream is line-split on `\n`, with malformed JSON ignored.
//   - one-at-a-time sendCommand acks resolve in arrival order.
//   - discover() drains its bonjour browser and returns the resolved devices.
//
// @vitest-environment node

import { EventEmitter } from 'node:events'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Fakes — minimal `net.Socket` + `bonjour-service` surface used by the SUT.
// Defined inside vi.hoisted() so vi.mock factories can reference them.
// ---------------------------------------------------------------------------

const fakes = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter } = require('node:events') as typeof import('node:events')

  type WriteCb = (err?: Error | null) => void

  class FakeSocket extends EventEmitter {
    static instances: FakeSocket[] = []
    writes: string[] = []
    destroyed = false

    constructor() {
      super()
      FakeSocket.instances.push(this)
    }

    setNoDelay(_v: boolean): void {
      /* no-op */
    }

    connect(_opts: { host: string; port: number }): this {
      // Real socket connects asynchronously — defer the event one tick so
      // listeners attached after `connect()` still see the edge.
      setImmediate(() => {
        this.emit('connect')
      })
      return this
    }

    write(data: string, cb?: WriteCb): boolean {
      this.writes.push(data)
      cb?.(null)
      return true
    }

    end(): this {
      // Mirror Node: end → close on next tick.
      setImmediate(() => {
        this.emit('close')
      })
      return this
    }

    destroy(_err?: Error): this {
      if (this.destroyed) return this
      this.destroyed = true
      setImmediate(() => {
        this.emit('close')
      })
      return this
    }

    /** Test helper — push a chunk of TCP data through the data listeners. */
    push(chunk: string): void {
      this.emit('data', Buffer.from(chunk, 'utf-8'))
    }
  }

  class FakeBrowser extends EventEmitter {
    stopped = false
    stop(): void {
      this.stopped = true
    }
  }

  interface ServiceEnvelope {
    name?: string
    host?: string
    port?: number
    addresses?: readonly string[]
  }

  class FakeBonjour {
    static queue: ServiceEnvelope[][] = []
    destroyed = false
    browser = new FakeBrowser()

    find(_opts: { type: string }, onup: (service: ServiceEnvelope) => void): FakeBrowser {
      const services = FakeBonjour.queue.shift() ?? []
      // Fire each service through onup asynchronously so the discover() promise
      // can wire its timeout before the first emit.
      setImmediate(() => {
        for (const s of services) onup(s)
      })
      return this.browser
    }

    destroy(): void {
      this.destroyed = true
    }
  }

  return { FakeSocket, FakeBonjour, FakeBrowser }
})

vi.mock('node:net', () => ({ Socket: fakes.FakeSocket }))
vi.mock('bonjour-service', () => ({ default: fakes.FakeBonjour }))

import { WifiService, putConfigTimeoutMs, DEFAULT_WIFI_PORT } from './wifi.service'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function latestSocket(): InstanceType<typeof fakes.FakeSocket> {
  const s = fakes.FakeSocket.instances.at(-1)
  if (!s) throw new Error('No socket instance recorded')
  return s
}

function waitForNextTick(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(() => {
      resolve()
    })
  })
}

beforeEach(() => {
  fakes.FakeSocket.instances.length = 0
  fakes.FakeBonjour.queue = []
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WifiService — connect / disconnect publish surface', () => {
  it('connect() resolves and publishes a connected:true event', async () => {
    const service = new WifiService()
    const onConnectionChanged = vi.fn()
    service.setEventHandlers({ onConnectionChanged })

    const result = await service.connect('192.168.4.1')

    expect(result.success).toBe(true)
    expect(onConnectionChanged).toHaveBeenCalledWith({
      connected: true,
      host: '192.168.4.1',
      intentional: true,
    })
    expect(service.isConnected()).toBe(true)
    expect(service.getStatus()).toEqual({
      connected: true,
      host: '192.168.4.1',
      port: DEFAULT_WIFI_PORT,
    })
  })

  it('voluntary disconnect() publishes connected:false with intentional=true', async () => {
    const service = new WifiService()
    const onConnectionChanged = vi.fn()
    service.setEventHandlers({ onConnectionChanged })

    await service.connect('192.168.4.1')
    onConnectionChanged.mockClear()

    await service.disconnect()

    expect(onConnectionChanged).toHaveBeenCalledWith({
      connected: false,
      host: null,
      intentional: true,
    })
    expect(service.isConnected()).toBe(false)
    expect(service.getStatus()).toEqual({ connected: false })
  })

  it('socket "close" without a voluntary disconnect publishes intentional=false', async () => {
    const service = new WifiService()
    const onConnectionChanged = vi.fn()
    service.setEventHandlers({ onConnectionChanged })

    await service.connect('192.168.4.1')
    onConnectionChanged.mockClear()

    // Simulate a remote-end drop (dash crash / WiFi loss).
    latestSocket().emit('close')

    expect(onConnectionChanged).toHaveBeenCalledWith({
      connected: false,
      host: null,
      intentional: false,
    })
  })

  it('disconnect() with no socket is a no-op (idempotent)', async () => {
    const service = new WifiService()
    const onConnectionChanged = vi.fn()
    service.setEventHandlers({ onConnectionChanged })

    const r1 = await service.disconnect()
    const r2 = await service.disconnect()

    expect(r1).toEqual({ success: true })
    expect(r2).toEqual({ success: true })
    expect(onConnectionChanged).not.toHaveBeenCalled()
  })
})

describe('WifiService — line splitting + JSON dispatch', () => {
  it('emits telemetry on a "tele" line and survives a split chunk', async () => {
    const service = new WifiService()
    const onTelemetry = vi.fn()
    service.setEventHandlers({ onTelemetry })

    await service.connect('192.168.4.1')
    const socket = latestSocket()

    // Split a single JSON frame across two TCP chunks — the line buffer must
    // coalesce on the trailing `\n`.
    socket.push('{"tele":1,"v":{"rpm":4500')
    expect(onTelemetry).not.toHaveBeenCalled()
    socket.push(',"speed":80}}\n')

    expect(onTelemetry).toHaveBeenCalledTimes(1)
    expect(onTelemetry).toHaveBeenCalledWith({ rpm: 4500, speed: 80 })
  })

  it('drops malformed JSON without throwing or resolving a pending ack', async () => {
    const service = new WifiService()
    service.setEventHandlers({})

    await service.connect('192.168.4.1')
    const socket = latestSocket()

    // Start an ack-bound command, then push junk — the ack must stay pending.
    const ack = service.toggleDayNight()
    socket.push('this is not json\n')
    socket.push('{"partial":\n') // syntactically broken
    socket.push('\n') // empty line

    // Resolve the ack explicitly to drain the awaited promise.
    socket.push('{"status":"ok"}\n')
    const result = await ack
    expect(result.success).toBe(true)
  })

  it('routes structured logs to onDeviceLog without resolving a pending ack', async () => {
    const service = new WifiService()
    const onDeviceLog = vi.fn()
    service.setEventHandlers({ onDeviceLog })

    await service.connect('192.168.4.1')
    const socket = latestSocket()

    const ackPromise = service.toggleDayNight()

    socket.push('{"log":1,"lvl":"I","tag":"WIFI","msg":"hello"}\n')
    expect(onDeviceLog).toHaveBeenCalledWith({
      level: 'I',
      tag: 'WIFI',
      message: 'hello',
    })

    // Ack still pending — resolve it explicitly so the test doesn't leak.
    socket.push('{"status":"ok"}\n')
    const ack = await ackPromise
    expect(ack.success).toBe(true)
  })
})

describe('WifiService — sendCommand acks in arrival order', () => {
  it('resolves two sequential commands in the order their responses arrive', async () => {
    const service = new WifiService()
    await service.connect('192.168.4.1')
    const socket = latestSocket()

    const first = service.toggleDayNight()
    socket.push('{"status":"ok","slot":1}\n')
    const r1 = await first
    expect(r1.success).toBe(true)

    const second = service.calibrateTouch()
    socket.push('{"status":"ok","slot":2}\n')
    const r2 = await second
    expect(r2.success).toBe(true)

    // Both writes hit the wire with a trailing newline.
    expect(socket.writes.every((w) => w.endsWith('\n'))).toBe(true)
    expect(socket.writes.filter((w) => w.includes('"cmd":7')).length).toBe(1)
    expect(socket.writes.filter((w) => w.includes('"cmd":8')).length).toBe(1)
  })

  it('surfaces a device "error" status as a failed result', async () => {
    const service = new WifiService()
    await service.connect('192.168.4.1')
    const socket = latestSocket()

    const promise = service.toggleDayNight()
    socket.push('{"status":"error","message":"unknown_cmd"}\n')
    const result = await promise

    expect(result).toEqual({ success: false, error: 'unknown_cmd' })
  })

  it('sendCommand on a disconnected service short-circuits without writing', async () => {
    const service = new WifiService()
    const result = await service.toggleDayNight()
    expect(result).toEqual({ success: false, error: 'Not connected to device' })
    expect(fakes.FakeSocket.instances.length).toBe(0)
  })
})

describe('WifiService.discover — bonjour browse', () => {
  it('returns the resolved IPv4 devices and tears down the browser', async () => {
    fakes.FakeBonjour.queue.push([
      { name: 'CANShift Dash', host: 'canshift.local', port: 5050, addresses: ['192.168.4.1'] },
      { name: 'Dual stack', host: 'other.local', port: 5050, addresses: ['fe80::1', '10.0.0.5'] },
    ])

    const service = new WifiService()
    const found = await service.discover(50)

    expect(found).toEqual([
      { name: 'CANShift Dash', host: '192.168.4.1', port: 5050, hostname: 'canshift.local' },
      { name: 'Dual stack', host: '10.0.0.5', port: 5050, hostname: 'other.local' },
    ])
  })

  it('returns an empty list when mDNS yields nothing', async () => {
    fakes.FakeBonjour.queue.push([])
    const service = new WifiService()
    const found = await service.discover(20)
    expect(found).toEqual([])
  })

  it('skips entries with no IPv4 address (IPv6-only)', async () => {
    fakes.FakeBonjour.queue.push([
      { name: 'v6-only', host: 'v6.local', port: 5050, addresses: ['fe80::abcd'] },
    ])
    const service = new WifiService()
    const found = await service.discover(20)
    expect(found).toEqual([])
  })
})

describe('putConfigTimeoutMs — ack timeout scaling (matches USB)', () => {
  it('clamps to the 5 s base for small payloads', () => {
    expect(putConfigTimeoutMs(0)).toBe(5_000)
    expect(putConfigTimeoutMs(100)).toBe(5_000 + 5) // 0.1 KB rounds up
  })

  it('caps at 60 s for very large payloads', () => {
    expect(putConfigTimeoutMs(10_000 * 1024)).toBe(60_000)
  })
})

// Silence "unused import" if eslint ever picks it up — EventEmitter is loaded
// transitively but referenced only inside vi.hoisted().
void EventEmitter
void waitForNextTick

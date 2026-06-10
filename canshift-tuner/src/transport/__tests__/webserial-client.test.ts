import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SerialClient, __resetSerialClientSingleton, getSerialClient } from '../webserial-client'

interface FakePort {
  port: SerialPort
  pushBytes: (bytes: Uint8Array | string) => void
  closeReader: () => void
  written: string[]
  opened: boolean
  closed: boolean
  closeCalls: number
}

const makeFakePort = (): FakePort => {
  let readableController: ReadableStreamDefaultController<Uint8Array> | null = null
  const written: string[] = []
  const decoder = new TextDecoder()
  const state = {
    opened: false,
    closed: false,
    closeCalls: 0,
  }

  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      readableController = controller
    },
  })

  const writable = new WritableStream<Uint8Array>({
    write(chunk) {
      written.push(decoder.decode(chunk))
    },
  })

  const port = {
    open: vi.fn(async () => {
      state.opened = true
    }),
    close: vi.fn(async () => {
      state.closeCalls++
      state.closed = true
      try {
        readableController?.close()
      } catch {}
    }),
    readable,
    writable,
  } as unknown as SerialPort

  return {
    port,
    pushBytes: (bytes) => {
      const encoded = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes
      readableController?.enqueue(encoded)
    },
    closeReader: () => {
      try {
        readableController?.close()
      } catch {}
    },
    get written() {
      return written
    },
    get opened() {
      return state.opened
    },
    get closed() {
      return state.closed
    },
    get closeCalls() {
      return state.closeCalls
    },
  }
}

const installNavigatorSerial = (getPortsResult: SerialPort[] = []): void => {
  const fakeSerial = {
    requestPort: vi.fn(async () => {
      throw new Error('test should pass a port directly')
    }),
    getPorts: vi.fn(async () => getPortsResult),
  }
  Object.defineProperty(globalThis, 'navigator', {
    value: { serial: fakeSerial },
    configurable: true,
  })
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

beforeEach(() => {
  installNavigatorSerial()
  __resetSerialClientSingleton()
})

afterEach(() => {
  __resetSerialClientSingleton()
  vi.useRealTimers()
})

describe('SerialClient — frame parser', () => {
  it('splits incoming bytes on newlines and dispatches each JSON object', async () => {
    const fake = makeFakePort()
    const client = new SerialClient({ disableReconnect: true })
    const tele = vi.fn()
    client.subscribe('tele', tele)

    await client.connect(fake.port)
    fake.pushBytes('{"tele":1,"v":{"rpm":1000}}\n{"tele":1,"v":{"rpm":2000}}\n')
    await flush()

    expect(tele).toHaveBeenCalledTimes(2)
    expect(tele).toHaveBeenNthCalledWith(1, { tele: 1, v: { rpm: 1000 } })
    expect(tele).toHaveBeenNthCalledWith(2, { tele: 1, v: { rpm: 2000 } })

    client.disconnect()
  })

  it('silently drops free-form text and warns only on malformed JSON object frames', async () => {
    const fake = makeFakePort()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const client = new SerialClient({ disableReconnect: true })
    const log = vi.fn()
    client.subscribe('log', log)

    await client.connect(fake.port)
    fake.pushBytes('\n\nnot-json\n[   485][E][Preferences.cpp:50] nvs_open failed\n')
    fake.pushBytes('{"log":1,"broken\n')
    fake.pushBytes('{"log":1,"lvl":"info","tag":"x","msg":"y"}\n')
    await flush()

    expect(log).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
    client.disconnect()
  })

  it('handles a frame split across multiple chunks', async () => {
    const fake = makeFakePort()
    const client = new SerialClient({ disableReconnect: true })
    const tele = vi.fn()
    client.subscribe('tele', tele)

    await client.connect(fake.port)
    fake.pushBytes('{"tele":1,"v":{"r')
    fake.pushBytes('pm":42}}\n')
    await flush()

    expect(tele).toHaveBeenCalledWith({ tele: 1, v: { rpm: 42 } })
    client.disconnect()
  })
})

describe('SerialClient — ack matching', () => {
  it('resolves the next non-discriminated `{status:"ok"}` frame as the ack', async () => {
    const fake = makeFakePort()
    const client = new SerialClient({ disableReconnect: true })

    await client.connect(fake.port)
    const ackPromise = client.send(0x02, { payload: { a: 1 } })
    await flush()

    expect(fake.written.join('')).toBe('{"cmd":2,"payload":{"a":1}}\n')

    fake.pushBytes('{"status":"ok","echo":true}\n')
    const ack = await ackPromise

    expect(ack.ok).toBe(true)
    expect(ack.data).toEqual({ status: 'ok', echo: true })
    client.disconnect()
  })

  it('resolves with a parsed error message on `{status:"error"}`', async () => {
    const fake = makeFakePort()
    const client = new SerialClient({ disableReconnect: true })

    await client.connect(fake.port)
    const ackPromise = client.send(0x03)
    await flush()
    fake.pushBytes('{"status":"error","message":"config_not_found"}\n')
    const ack = await ackPromise

    expect(ack.ok).toBe(false)
    expect(ack.error).toBe('config_not_found')
    client.disconnect()
  })
})

describe('SerialClient — subscription dispatch', () => {
  it('routes `log` / `tele` / `can` / `can_stat` frames to handlers without resolving an ack', async () => {
    const fake = makeFakePort()
    const client = new SerialClient({ disableReconnect: true })
    const log = vi.fn()
    const tele = vi.fn()
    const can = vi.fn()
    const canStat = vi.fn()
    client.subscribe('log', log)
    client.subscribe('tele', tele)
    client.subscribe('can', can)
    client.subscribe('can_stat', canStat)

    await client.connect(fake.port)

    const ackPromise = client.send(0x10)
    await flush()
    fake.pushBytes('{"log":1,"lvl":"info","tag":"x","msg":"y"}\n')
    fake.pushBytes('{"tele":1,"v":{"rpm":1}}\n')
    fake.pushBytes('{"can":1,"id":1,"len":0,"d":[]}\n')
    fake.pushBytes('{"can_stat":1,"fps":10,"errors":0}\n')
    await flush()

    expect(log).toHaveBeenCalledTimes(1)
    expect(tele).toHaveBeenCalledTimes(1)
    expect(can).toHaveBeenCalledTimes(1)
    expect(canStat).toHaveBeenCalledTimes(1)

    let resolved = false
    void ackPromise.then(() => {
      resolved = true
    })
    await flush()
    expect(resolved).toBe(false)

    fake.pushBytes('{"status":"ok"}\n')
    await ackPromise
    client.disconnect()
  })
})

describe('SerialClient — single-instance behaviour', () => {
  it('closes the previous port when a second connect() is called', async () => {
    const first = makeFakePort()
    const second = makeFakePort()
    const client = new SerialClient({ disableReconnect: true })

    await client.connect(first.port)
    expect(first.opened).toBe(true)
    expect(client.getPort()).toBe(first.port)

    await client.connect(second.port)
    await flush()

    expect(first.closeCalls).toBeGreaterThanOrEqual(1)
    expect(second.opened).toBe(true)
    expect(client.getPort()).toBe(second.port)

    client.disconnect()
  })
})

describe('SerialClient — send queue', () => {
  it('resolves the 9th concurrent send with queue_full', async () => {
    const fake = makeFakePort()
    const client = new SerialClient({ disableReconnect: true })

    await client.connect(fake.port)

    const inFlight = client.send(0x01)
    const queued: Promise<unknown>[] = []
    for (let i = 0; i < 8; i++) {
      queued.push(client.send(0x01))
    }
    const overflow = await client.send(0x01)

    expect(overflow.ok).toBe(false)
    expect(overflow.error).toBe('queue_full')

    fake.pushBytes('{"status":"ok"}\n')
    await flush()
    await inFlight
    for (let i = 0; i < 8; i++) {
      await flush()
      fake.pushBytes('{"status":"ok"}\n')
      await flush()
    }
    await Promise.all(queued)
    client.disconnect()
  })
})

describe('getSerialClient singleton', () => {
  it('returns the same instance across calls', () => {
    const a = getSerialClient()
    const b = getSerialClient()
    expect(a).toBe(b)
  })
})

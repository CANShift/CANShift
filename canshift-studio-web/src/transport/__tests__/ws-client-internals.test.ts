// transport/__tests__/ws-client-internals.test.ts — Direct coverage for the
// `WsClient` state machine (#1077 follow-up). The existing `ws-client.test.ts`
// only exercises the high-level IPC layer above the singleton; this suite
// drives the class via the `webSocketFactory` injection so we can simulate
// connect / message / close events deterministically without hitting the
// network.
//
// Each test constructs a fresh `WsClient` with a `FakeWebSocket` factory.
// Vitest's fake timers drive the reconnect backoff + ack-timeout paths so we
// can assert on the exact delays without sleeping.
//
// Concerns covered:
// - status transitions: connecting → connected → disconnected
// - intentional disconnect suppresses reconnect; auto-reconnect re-engages
//   on socket close with exponential backoff (RECONNECT_INITIAL_MS, x2, capped)
// - ack lifecycle: happy ack, malformed JSON dropped, ack timeout, pending
//   ack cleared by disconnect
// - subscriptions: matched frames consumed BEFORE the ack handler;
//   unsubscribe removes the listener
// - refusal frame `single-client only` surfaces as `single_client` close reason
// - `send()` rejects when not connected or when another ack is already in flight

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WsClient, putConfigTimeoutMs } from '../ws-client'

// ---------------------------------------------------------------------------
// FakeWebSocket — minimal stand-in matching the subset of the DOM WebSocket
// surface the client actually uses (`addEventListener`, `send`, `close`).
// Exposes `emit` so tests can drive lifecycle events on their own schedule.
// ---------------------------------------------------------------------------

type EventName = 'open' | 'message' | 'error' | 'close'
type Listener = (event: unknown) => void

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  readonly url: string
  readonly sent: string[] = []
  closed = false
  private readonly listeners = new Map<EventName, Listener[]>()

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  addEventListener(name: EventName, listener: Listener): void {
    const arr = this.listeners.get(name) ?? []
    arr.push(listener)
    this.listeners.set(name, arr)
  }

  send(payload: string): void {
    this.sent.push(payload)
  }

  close(): void {
    this.closed = true
  }

  emit(name: EventName, event: unknown = {}): void {
    for (const l of this.listeners.get(name) ?? []) l(event)
  }
}

function makeFactory() {
  FakeWebSocket.instances = []
  return (url: string) => new FakeWebSocket(url) as unknown as WebSocket
}

function latestSocket(): FakeWebSocket {
  const ws = FakeWebSocket.instances[FakeWebSocket.instances.length - 1]
  if (!ws) throw new Error('no fake socket created')
  return ws
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('WsClient — status transitions', () => {
  it('emits connecting → connected on a successful open', async () => {
    const client = new WsClient({ host: 'h', port: 1, webSocketFactory: makeFactory() })
    const seen: string[] = []
    client.onStatus((s) => seen.push(s))

    const pending = client.connect()
    expect(client.getStatus()).toBe('connecting')

    latestSocket().emit('open')
    await pending

    expect(client.getStatus()).toBe('connected')
    expect(seen).toEqual(['connecting', 'connected'])
  })

  it('intentional disconnect transitions to disconnected and does NOT reconnect', async () => {
    const client = new WsClient({ webSocketFactory: makeFactory() })
    const pending = client.connect()
    latestSocket().emit('open')
    await pending

    client.disconnect()
    // Fake-close because the real browser would fire `close` after `ws.close()`;
    // the client already set status synchronously inside `disconnect`.
    latestSocket().emit('close', { reason: '' })

    expect(client.getStatus()).toBe('disconnected')

    // Advance well past the first backoff window — no new socket should appear.
    const before = FakeWebSocket.instances.length
    vi.advanceTimersByTime(60_000)
    expect(FakeWebSocket.instances.length).toBe(before)
  })

  it('schedules a reconnect after an unexpected close once we were connected', async () => {
    const client = new WsClient({ webSocketFactory: makeFactory() })
    const pending = client.connect()
    latestSocket().emit('open')
    await pending
    expect(client.getStatus()).toBe('connected')

    // Server-side drop.
    latestSocket().emit('close', { reason: 'kicked' })
    expect(client.getStatus()).toBe('reconnecting')

    // First backoff is 500 ms — advancing exactly that opens a fresh socket.
    expect(FakeWebSocket.instances.length).toBe(1)
    vi.advanceTimersByTime(500)
    expect(FakeWebSocket.instances.length).toBe(2)
  })

  it('exponential backoff doubles the delay on consecutive failed reconnects', async () => {
    const client = new WsClient({ webSocketFactory: makeFactory() })
    const pending = client.connect()
    latestSocket().emit('open')
    await pending

    // Drop, then fail the reconnect — backoff should now be 1000 ms.
    latestSocket().emit('close', { reason: 'drop' })
    vi.advanceTimersByTime(500)
    expect(FakeWebSocket.instances.length).toBe(2)
    latestSocket().emit('close', { reason: 'drop' })

    // 500 ms must NOT trigger another attempt — only 1000 ms does.
    const beforeCount = FakeWebSocket.instances.length
    vi.advanceTimersByTime(500)
    expect(FakeWebSocket.instances.length).toBe(beforeCount)
    vi.advanceTimersByTime(500)
    expect(FakeWebSocket.instances.length).toBe(beforeCount + 1)
  })
})

describe('WsClient — send / ack lifecycle', () => {
  async function connect(): Promise<WsClient> {
    const client = new WsClient({ webSocketFactory: makeFactory() })
    const p = client.connect()
    latestSocket().emit('open')
    await p
    return client
  }

  it('resolves with the parsed frame when the firmware acks status:"ok"', async () => {
    const client = await connect()
    const ws = latestSocket()

    const acked = client.send(0x01, { foo: 1 })
    expect(ws.sent[0]).toBe('{"cmd":1,"foo":1}')

    ws.emit('message', { data: '{"status":"ok","result":42}' })
    await expect(acked).resolves.toEqual({
      ok: true,
      data: { status: 'ok', result: 42 },
    })
  })

  it('returns not_connected when called before the socket is open', async () => {
    const client = new WsClient({ webSocketFactory: makeFactory() })
    const result = await client.send(0x01)
    expect(result).toEqual({ ok: false, error: 'not_connected' })
  })

  it('returns ack_in_flight while a previous send is pending', async () => {
    const client = await connect()
    const first = client.send(0x01)
    const second = await client.send(0x02)

    expect(second).toEqual({ ok: false, error: 'ack_in_flight' })
    // Drain the first so the test doesn't leave a dangling timer.
    latestSocket().emit('message', { data: '{"status":"ok"}' })
    await first
  })

  it('resolves with ack_timeout when no ack lands before the deadline', async () => {
    const client = await connect()
    const pending = client.send(0x01, {}, { timeoutMs: 100 })
    vi.advanceTimersByTime(100)
    await expect(pending).resolves.toEqual({ ok: false, error: 'ack_timeout' })

    // After the timeout the slot is free — a follow-up send must NOT be
    // rejected as `ack_in_flight`.
    const next = client.send(0x02)
    latestSocket().emit('message', { data: '{"status":"ok"}' })
    await expect(next).resolves.toMatchObject({ ok: true })
  })

  it('drops malformed JSON frames without consuming a pending ack', async () => {
    const client = await connect()
    const ws = latestSocket()
    const acked = client.send(0x01, {}, { timeoutMs: 1_000 })

    ws.emit('message', { data: '{not json' })
    ws.emit('message', { data: 'plain text' })
    ws.emit('message', { data: '{"status":"ok","done":true}' })

    await expect(acked).resolves.toEqual({
      ok: true,
      data: { status: 'ok', done: true },
    })
  })

  it('clears the pending ack on disconnect mid-flight', async () => {
    const client = await connect()
    const acked = client.send(0x01, {}, { timeoutMs: 5_000 })

    latestSocket().emit('close', { reason: 'lost' })
    await expect(acked).resolves.toEqual({ ok: false, error: 'connection_closed' })
  })

  it('surfaces a non-ok firmware response as an error string', async () => {
    const client = await connect()
    const acked = client.send(0x01)
    latestSocket().emit('message', {
      data: '{"status":"error","message":"crc_failed"}',
    })
    const result = await acked
    expect(result.ok).toBe(false)
    expect(result.error).toBe('crc_failed')
    expect(result.data).toMatchObject({ status: 'error', message: 'crc_failed' })
  })

  it('scales the ack timeout for large payloads via scaleWithPayload', async () => {
    // Sanity-check the scaling helper while we have a unit-friendly entry point.
    expect(putConfigTimeoutMs(0)).toBe(5_000)
    expect(putConfigTimeoutMs(60_000)).toBeGreaterThan(7_000)
    expect(putConfigTimeoutMs(10_000_000)).toBeLessThanOrEqual(60_000)

    const client = await connect()
    const ws = latestSocket()

    // Drives `send` to construct a 10kB-ish payload.
    const bigField = 'x'.repeat(10_000)
    const pending = client.send(0x99, { blob: bigField }, { scaleWithPayload: true })

    // The default 5s timeout would fire here; confirm it does NOT.
    vi.advanceTimersByTime(5_000)
    ws.emit('message', { data: '{"status":"ok"}' })
    await expect(pending).resolves.toMatchObject({ ok: true })
  })
})

describe('WsClient — subscriptions', () => {
  async function connect(): Promise<WsClient> {
    const client = new WsClient({ webSocketFactory: makeFactory() })
    const p = client.connect()
    latestSocket().emit('open')
    await p
    return client
  }

  it('routes a discriminator frame to its handler and NOT the ack path', async () => {
    const client = await connect()
    const ws = latestSocket()
    const onTele = vi.fn()
    client.subscribe('tele', onTele)

    const acked = client.send(0x01, {}, { timeoutMs: 1_000 })
    ws.emit('message', { data: '{"tele":1,"v":{"rpm":1234}}' })

    expect(onTele).toHaveBeenCalledWith({ tele: 1, v: { rpm: 1234 } })

    // The ack is still in flight — the tele frame must not have resolved it.
    ws.emit('message', { data: '{"status":"ok"}' })
    await expect(acked).resolves.toMatchObject({ ok: true })
  })

  it('unsubscribe removes the listener', async () => {
    const client = await connect()
    const ws = latestSocket()
    const onTele = vi.fn()
    const off = client.subscribe('tele', onTele)
    off()

    ws.emit('message', { data: '{"tele":1,"v":{}}' })
    expect(onTele).not.toHaveBeenCalled()
  })

  it('refusal frame is recognised and surfaced as the close reason', async () => {
    const client = new WsClient({ webSocketFactory: makeFactory(), disableReconnect: true })
    const statuses: { status: string; error: string | undefined }[] = []
    client.onStatus((s, e) => statuses.push({ status: s, error: e }))

    const pending = client.connect()
    const ws = latestSocket()
    ws.emit('open')
    await pending

    ws.emit('message', { data: 'single-client only' })
    ws.emit('close', { reason: '' })

    const last = statuses[statuses.length - 1]
    expect(last?.status).toBe('disconnected')
    expect(last?.error).toBe('single_client')
  })
})

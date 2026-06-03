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

  it('queues a follow-up send while a previous ack is in flight (#1288 WS-3)', async () => {
    const client = await connect()
    const ws = latestSocket()
    const first = client.send(0x01, { a: 1 })
    const second = client.send(0x02, { b: 2 })

    // Only the first frame is on the wire; the second waits for the ack drain.
    expect(ws.sent).toEqual(['{"cmd":1,"a":1}'])

    ws.emit('message', { data: '{"status":"ok","seq":1}' })
    await expect(first).resolves.toMatchObject({ ok: true, data: { seq: 1 } })

    // After the first ack lands the queued send is dispatched.
    expect(ws.sent).toEqual(['{"cmd":1,"a":1}', '{"cmd":2,"b":2}'])
    ws.emit('message', { data: '{"status":"ok","seq":2}' })
    await expect(second).resolves.toMatchObject({ ok: true, data: { seq: 2 } })
  })

  it('rejects sends with queue_full once the queue is at capacity (#1288 WS-3)', async () => {
    const client = await connect()
    const ws = latestSocket()
    const first = client.send(0x01)

    // Fill the 8-deep queue.
    const queued: Promise<unknown>[] = []
    for (let i = 0; i < 8; i++) queued.push(client.send(0x02))

    const overflow = await client.send(0x03)
    expect(overflow).toEqual({ ok: false, error: 'queue_full' })

    // Drain everything so timers don't leak.
    ws.emit('message', { data: '{"status":"ok"}' })
    await first
    for (let i = 0; i < 8; i++) ws.emit('message', { data: '{"status":"ok"}' })
    await Promise.all(queued)
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

  it('refusal frame disables auto-reconnect until next explicit connect (#1288 WS-1)', async () => {
    const client = new WsClient({ webSocketFactory: makeFactory() })

    const pending = client.connect()
    latestSocket().emit('open')
    await pending

    latestSocket().emit('message', { data: 'single-client only' })
    latestSocket().emit('close', { reason: '' })

    const before = FakeWebSocket.instances.length
    vi.advanceTimersByTime(60_000)
    expect(FakeWebSocket.instances.length).toBe(before)

    // An explicit reconnect attempt must re-arm the loop.
    const next = client.connect()
    latestSocket().emit('open')
    await next
    expect(FakeWebSocket.instances.length).toBe(before + 1)
  })

  it('routes ack frames to the pending ack even when a discriminator key is present (#1288 WS-4)', async () => {
    const client = new WsClient({ webSocketFactory: makeFactory() })
    const pending = client.connect()
    latestSocket().emit('open')
    await pending

    const ws = latestSocket()
    const onLog = vi.fn()
    client.subscribe('log', onLog)

    const acked = client.send(0x99, {}, { timeoutMs: 1_000 })

    // Future firmware could ship an ack like `{status:"ok", log:"saved"}` — the
    // ack handler MUST win the dispatch.
    ws.emit('message', { data: '{"status":"ok","log":"saved"}' })

    await expect(acked).resolves.toMatchObject({ ok: true, data: { log: 'saved' } })
    expect(onLog).not.toHaveBeenCalled()
  })
})

describe('WsClient — reconnect backoff stability gate (#1288 WS-2)', () => {
  it('keeps the doubled backoff when the link drops before STABLE_UPTIME_MS', async () => {
    const client = new WsClient({ webSocketFactory: makeFactory() })

    // First attempt — open then drop instantly. Scheduled at 500 ms; timer
    // doubles backoff to 1000 ms before opening instance 2.
    const first = client.connect()
    latestSocket().emit('open')
    await first
    latestSocket().emit('close', { reason: 'drop' })
    vi.advanceTimersByTime(500)
    expect(FakeWebSocket.instances.length).toBe(2)

    // Second attempt — open and drop after only 1 s of uptime. Without the
    // stability gate this would reset the backoff to 500 ms. With the gate,
    // it stays at 1000 ms; the next timer doubles it to 2000 ms.
    latestSocket().emit('open')
    vi.advanceTimersByTime(1_000)
    latestSocket().emit('close', { reason: 'drop' })

    // Reconnect is scheduled at the unchanged 1000 ms. After it fires the
    // backoff doubles to 2000 ms — well above the pre-fix 500 ms floor.
    vi.advanceTimersByTime(1_000)
    expect(FakeWebSocket.instances.length).toBe(3)

    // Now the next close + reconnect cycle uses the 2000 ms backoff. 1000 ms
    // is NOT enough; 2000 ms total fires the timer and opens instance 4.
    latestSocket().emit('close', { reason: 'drop' })
    const before = FakeWebSocket.instances.length
    vi.advanceTimersByTime(1_000)
    expect(FakeWebSocket.instances.length).toBe(before)
    vi.advanceTimersByTime(1_000)
    expect(FakeWebSocket.instances.length).toBe(before + 1)
  })

  it('resets the backoff once the link survives STABLE_UPTIME_MS', async () => {
    const client = new WsClient({ webSocketFactory: makeFactory() })

    const first = client.connect()
    latestSocket().emit('open')
    await first
    latestSocket().emit('close', { reason: 'drop' })
    vi.advanceTimersByTime(500)
    expect(FakeWebSocket.instances.length).toBe(2)

    // Sustained uptime — well past STABLE_UPTIME_MS (10 s).
    latestSocket().emit('open')
    vi.advanceTimersByTime(15_000)
    latestSocket().emit('close', { reason: 'drop' })

    // Backoff was reset to 500 ms on close. The reconnect timer fires at
    // 500 ms and opens instance 3 — restoring the fresh-floor behaviour.
    const before = FakeWebSocket.instances.length
    vi.advanceTimersByTime(500)
    expect(FakeWebSocket.instances.length).toBe(before + 1)
  })
})

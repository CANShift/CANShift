// transport/ws-client.ts — Real WebSocket client for the dash-hosted Studio.
//
// Replaces the phase-1 stub bodies in `transport/index.ts` (#1077 / #1108).
// The firmware exposes a single text-frame WS endpoint on port 81 that
// mirrors the TCP 5050 wire protocol: each frame is one complete JSON
// object — but WITHOUT the trailing `\n` the USB / TCP transports carry
// (frame boundary replaces it, see `canshift-firmware/src/hal/wifi/wifi_ws.cpp`).
//
// Surface
// -------
// - `WsClient` owns one `WebSocket` at a time, exposes `connect/disconnect`,
//   `send(cmd, fields, opts)` that resolves on the firmware's `status:"ok"`
//   ack, and `subscribe<T>(discriminator, handler)` for unsolicited frames.
// - Reconnect: exponential backoff capped at ~30 s. Disabled when the user
//   explicitly disconnects. Re-engaged by the next `connect()` call.
// - Single-client refusal: the firmware sends a text frame `single-client only`
//   then closes. We surface that as a `single_client` connection error so the
//   UI can show a meaningful message instead of "connection closed".
//
// Kept deliberately small (< ~250 LoC). No external WebSocket library — the
// browser's native `WebSocket` covers everything we need.

const DEFAULT_PORT = 81
const DEFAULT_HOST = 'canshift.local'

const ACK_TIMEOUT_MS = 5_000
const PUT_CONFIG_BASE_TIMEOUT_MS = ACK_TIMEOUT_MS
const PUT_CONFIG_PER_KB_MS = 50
const PUT_CONFIG_MAX_TIMEOUT_MS = 60_000
const BYTES_PER_KB = 1024

const RECONNECT_INITIAL_MS = 500
const RECONNECT_MAX_MS = 30_000
const RECONNECT_FACTOR = 2

const REFUSAL_FRAME = 'single-client only'

export type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export interface WsClientOptions {
  host?: string
  port?: number
  /**
   * Inject a WebSocket constructor for tests. Defaults to the global one in
   * the browser. Kept structurally minimal — we only use `send`, `close`,
   * `addEventListener` and the four standard events.
   */
  webSocketFactory?: (url: string) => WebSocket
  /**
   * Disable auto-reconnect (used by the mock-server harness and tests).
   * Production callers leave this off so disconnects retry transparently.
   */
  disableReconnect?: boolean
}

export interface SendOptions {
  /** Override the default 5 s ack timeout. */
  timeoutMs?: number
  /**
   * Scale the timeout based on payload size. Use this for push-config so a
   * large JSON doesn't false-positive a slow firmware write as "no ack".
   */
  scaleWithPayload?: boolean
}

export interface AckResult {
  ok: boolean
  data?: Record<string, unknown>
  error?: string
}

type StatusListener = (status: WsStatus, error?: string) => void
type Handler<T> = (event: T) => void
type Unsubscribe = () => void

interface PendingAck {
  resolve: (result: AckResult) => void
  timer: ReturnType<typeof setTimeout>
}

interface Subscription {
  discriminator: string
  handler: Handler<unknown>
}

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

/** Same scaling as `putConfigTimeoutMs` in `canshift-studio/main/services`. */
export function putConfigTimeoutMs(payloadBytes: number): number {
  const sizeKB = payloadBytes / BYTES_PER_KB
  const scaled = Math.ceil(sizeKB * PUT_CONFIG_PER_KB_MS) + PUT_CONFIG_BASE_TIMEOUT_MS
  return Math.min(PUT_CONFIG_MAX_TIMEOUT_MS, Math.max(PUT_CONFIG_BASE_TIMEOUT_MS, scaled))
}

export class WsClient {
  private ws: WebSocket | null = null
  private host: string
  private port: number
  private status: WsStatus = 'disconnected'
  private intentionalDisconnect = false
  private pendingAck: PendingAck | null = null
  private subscriptions: Subscription[] = []
  private statusListeners: StatusListener[] = []
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = RECONNECT_INITIAL_MS
  private lastError: string | undefined
  private readonly factory: (url: string) => WebSocket
  private readonly autoReconnect: boolean

  constructor(opts: WsClientOptions = {}) {
    this.host = opts.host ?? DEFAULT_HOST
    this.port = opts.port ?? DEFAULT_PORT
    this.factory = opts.webSocketFactory ?? ((url) => new WebSocket(url))
    this.autoReconnect = !opts.disableReconnect
  }

  getStatus(): WsStatus {
    return this.status
  }

  getHost(): string {
    return this.host
  }

  getPort(): number {
    return this.port
  }

  /**
   * Subscribe to status transitions. Returns an unsubscribe function.
   * Listeners are called synchronously inside the state-change path.
   */
  onStatus(listener: StatusListener): Unsubscribe {
    this.statusListeners.push(listener)
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener)
    }
  }

  /**
   * Subscribe to unsolicited frames whose JSON object contains the given
   * discriminator key (e.g. `tele`, `can_stat`, `can`, `log`). Returns an
   * unsubscribe handle. Multiple subscribers per discriminator are allowed.
   */
  subscribe<T = unknown>(discriminator: string, handler: Handler<T>): Unsubscribe {
    const entry: Subscription = { discriminator, handler: handler as Handler<unknown> }
    this.subscriptions.push(entry)
    return () => {
      this.subscriptions = this.subscriptions.filter((s) => s !== entry)
    }
  }

  /**
   * Open a connection to `host:port`. Resolves once the socket is open or
   * rejects on the first failure. Subsequent disconnects fire status events
   * but do not reject the original promise.
   */
  connect(host?: string, port?: number): Promise<void> {
    if (host !== undefined) this.host = host
    if (port !== undefined) this.port = port

    this.intentionalDisconnect = false
    this.cancelReconnect()
    this.reconnectDelay = RECONNECT_INITIAL_MS

    return this.openSocket()
  }

  /** Close the current socket without scheduling a reconnect. */
  disconnect(): void {
    this.intentionalDisconnect = true
    this.cancelReconnect()
    this.failPendingAck('disconnected')
    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        // Ignore — `close` throws only on invalid states; teardown still runs.
      }
    }
    this.setStatus('disconnected')
  }

  /**
   * Send a command frame and await the firmware's `status:"ok"` ack.
   * Resolves with `{ ok: true, data }` or `{ ok: false, error }`.
   */
  send(cmd: number, fields: Record<string, unknown> = {}, opts: SendOptions = {}): Promise<AckResult> {
    if (!this.ws || this.status !== 'connected') {
      return Promise.resolve({ ok: false, error: 'not_connected' })
    }
    if (this.pendingAck) {
      return Promise.resolve({ ok: false, error: 'ack_in_flight' })
    }

    const payload = JSON.stringify({ cmd, ...fields })
    const timeoutMs = opts.scaleWithPayload
      ? putConfigTimeoutMs(payload.length)
      : (opts.timeoutMs ?? ACK_TIMEOUT_MS)

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingAck = null
        resolve({ ok: false, error: 'ack_timeout' })
      }, timeoutMs)

      this.pendingAck = { resolve, timer }

      try {
        this.ws?.send(payload)
      } catch (err) {
        clearTimeout(timer)
        this.pendingAck = null
        resolve({ ok: false, error: err instanceof Error ? err.message : 'send_failed' })
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private openSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.setStatus(this.reconnectDelay > RECONNECT_INITIAL_MS ? 'reconnecting' : 'connecting')

      let settled = false
      const settle = (err?: string) => {
        if (settled) return
        settled = true
        if (err) reject(new Error(err))
        else resolve()
      }

      let ws: WebSocket
      try {
        ws = this.factory(`ws://${this.host}:${String(this.port)}/`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'socket_create_failed'
        this.lastError = msg
        this.setStatus('disconnected', msg)
        this.scheduleReconnect()
        settle(msg)
        return
      }
      this.ws = ws

      ws.addEventListener('open', () => {
        this.reconnectDelay = RECONNECT_INITIAL_MS
        this.lastError = undefined
        this.setStatus('connected')
        settle()
      })

      ws.addEventListener('message', (ev: MessageEvent) => {
        this.onFrame(typeof ev.data === 'string' ? ev.data : '')
      })

      ws.addEventListener('error', () => {
        // The `error` event carries no message in browsers — `close` fires
        // right after with the real reason. We only stash a generic hint so
        // pre-open failures surface something useful.
        if (!settled) this.lastError = 'connect_failed'
      })

      ws.addEventListener('close', (ev: CloseEvent) => {
        this.failPendingAck('connection_closed')
        const wasConnected = this.status === 'connected'
        this.ws = null
        if (this.intentionalDisconnect) {
          this.setStatus('disconnected')
          settle('disconnected')
          return
        }
        const reason = this.lastError ?? (ev.reason || 'connection_closed')
        this.setStatus('disconnected', reason)
        settle(reason)
        if (wasConnected || this.reconnectDelay > RECONNECT_INITIAL_MS) {
          this.scheduleReconnect()
        }
      })
    })
  }

  private onFrame(raw: string): void {
    if (!raw) return

    // The firmware refuses extra clients with a single text frame of literal
    // "single-client only" before disconnecting. Surface it as the close
    // reason so the connection store can show a meaningful error.
    if (raw === REFUSAL_FRAME) {
      this.lastError = 'single_client'
      return
    }

    const parsed = safeJsonParse(raw)
    if (!isRecord(parsed)) return

    // Discriminator dispatch — tele / can_stat / can / log live alongside
    // command acks, so we route them first. Any frame matching a known
    // subscription is consumed and never falls through to the ack handler.
    for (const sub of this.subscriptions) {
      if (sub.discriminator in parsed) {
        sub.handler(parsed)
        return
      }
    }

    if (this.pendingAck) {
      const ack = this.pendingAck
      this.pendingAck = null
      clearTimeout(ack.timer)
      const status = parsed.status
      if (status === 'ok') {
        ack.resolve({ ok: true, data: parsed })
      } else {
        const msg = typeof parsed.message === 'string' ? parsed.message : 'device_error'
        ack.resolve({ ok: false, error: msg, data: parsed })
      }
    }
  }

  private failPendingAck(reason: string): void {
    if (!this.pendingAck) return
    const ack = this.pendingAck
    this.pendingAck = null
    clearTimeout(ack.timer)
    ack.resolve({ ok: false, error: reason })
  }

  private scheduleReconnect(): void {
    if (!this.autoReconnect || this.intentionalDisconnect) return
    if (this.reconnectTimer) return

    this.setStatus('reconnecting', this.lastError)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.reconnectDelay = Math.min(this.reconnectDelay * RECONNECT_FACTOR, RECONNECT_MAX_MS)
      void this.openSocket().catch(() => {
        // openSocket() already scheduled the next backoff via `close`.
      })
    }, this.reconnectDelay)
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private setStatus(next: WsStatus, error?: string): void {
    if (this.status === next && this.lastError === error) return
    this.status = next
    if (error !== undefined) this.lastError = error
    for (const listener of this.statusListeners) {
      try {
        listener(next, this.lastError)
      } catch {
        // Swallow listener errors — one bad consumer should not poison others.
      }
    }
  }
}

/**
 * Module-level singleton — the stores and hooks all reach for the same
 * client instance. Tests can construct their own `WsClient` to drive an
 * injected factory.
 */
let singleton: WsClient | null = null

export function getWsClient(): WsClient {
  if (!singleton) singleton = new WsClient()
  return singleton
}

/** Reset the singleton — used by tests; not exported from `transport/index`. */
export function __resetWsClientSingleton(): void {
  if (singleton) singleton.disconnect()
  singleton = null
}

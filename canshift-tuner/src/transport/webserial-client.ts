// transport/webserial-client.ts — Real WebSerial client for the canshift-tuner SPA.
//
// Mirrors `canshift-studio-web/src/transport/ws-client.ts` but speaks the
// firmware's USB-CDC line protocol over `navigator.serial` (CH340 UART).
// Each direction is one newline-terminated JSON object — same envelope as
// USB-CDC studio (`{cmd, payload, ...}` out, `{status, message?, ...}` in).

const DEFAULT_BAUD_RATE = 115_200

const ACK_TIMEOUT_MS = 5_000
const PUT_CONFIG_BASE_TIMEOUT_MS = ACK_TIMEOUT_MS
const PUT_CONFIG_PER_KB_MS = 50
const PUT_CONFIG_MAX_TIMEOUT_MS = 60_000
const BYTES_PER_KB = 1024

const RECONNECT_INITIAL_MS = 500
const RECONNECT_MAX_MS = 30_000
const RECONNECT_FACTOR = 2

/** Uptime threshold before we credit the link stable enough to reset backoff. */
const STABLE_UPTIME_MS = 10_000

/** Bounded send queue — beyond this, new sends resolve with `queue_full`. */
const SEND_QUEUE_CAPACITY = 8

export type SerialStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

/**
 * Map a raw WebSerial `port.open()` exception to a human-readable hint. The
 * native messages ("Failed to execute 'open' on 'SerialPort'…") are accurate
 * but tell the user nothing about WHAT to fix.
 */
function humanizeOpenError(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes('failed to open') || lower.includes('already open')) {
    return 'Port busy — close other apps using it (PlatformIO Monitor, Arduino IDE, `screen`, another browser tab) and click Connect device again.'
  }
  if (lower.includes('notfounderror') || lower.includes('not found')) {
    return 'Device not found — check the cable and unplug/replug the dash.'
  }
  if (lower.includes('access denied') || lower.includes('permission')) {
    return 'Permission denied — re-grant access via Connect device.'
  }
  return raw
}

export interface SerialClientOptions {
  baudRate?: number
  /** Disable auto-reconnect (used by tests). */
  disableReconnect?: boolean
}

export interface SendOptions {
  timeoutMs?: number
  /** Scale timeout with payload size (used for PUSH_CONFIG bursts). */
  scaleWithPayload?: boolean
}

export interface AckResult {
  ok: boolean
  data?: Record<string, unknown>
  error?: string
}

type StatusListener = (status: SerialStatus, error?: string) => void
type Handler<T> = (event: T) => void
type Unsubscribe = () => void

/** Direction tag forwarded to `onActivity` listeners. */
export type SerialActivityDirection = 'rx' | 'tx'
type ActivityListener = (direction: SerialActivityDirection) => void

interface PendingAck {
  resolve: (result: AckResult) => void
  timer: ReturnType<typeof setTimeout>
}

interface QueuedSend {
  cmd: number
  fields: Record<string, unknown>
  opts: SendOptions
  resolve: (result: AckResult) => void
}

interface Subscription {
  discriminator: string
  handler: Handler<unknown>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Try to parse `line` as JSON.
 *
 * The firmware multiplexes several streams onto the same UART:
 *   - structured logger frames: `{"log":1,...}` / `{"tele":1,...}` / etc.
 *   - Arduino-framework `log_e()` lines: `[   485][E][Preferences.cpp:50] …`
 *   - LVGL `[Warn]` / `[Error]` lines
 *   - ROM bootloader + ESP-IDF startup banner (`ets Jun  8 2016`, `rst:0xc`,
 *     `configsip:`, `clk_drv:`, `mode:DIO`, `load:`, `entry`, `E (476) psram:`,
 *     etc.) on every reset
 *
 * Only the first family is JSON. The rest is free-form text we'll surface to
 * the (future) CLI panel as-is. Warn ONLY when a line looks like it WAS trying
 * to be JSON (starts with `{`/`[` after trimming) but failed — that's a real
 * protocol error worth investigating. Free-form text is dropped silently to
 * avoid flooding the browser console with hundreds of warnings per boot.
 */
function safeJsonParse(line: string): unknown {
  const trimmed = line.trim()
  if (trimmed.length === 0) return null
  // Every frame the firmware emits via the Logger is a JSON OBJECT ({"log":1,
  // ...}, {"tele":1,...}, {"status":"ok"}, …) — never a top-level array.
  // Arduino-framework `log_e()` lines `[   485][E][Preferences.cpp:50] …` and
  // LVGL `[Warn] …` lines also start with `[` but are not JSON, so restricting
  // to `{` lets us silently drop the free-form text while still warning on
  // genuine malformed object frames.
  const looksLikeFrame = trimmed.startsWith('{')
  if (!looksLikeFrame) return null
  try {
    return JSON.parse(trimmed) as unknown
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown'
    const preview = trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed
    console.warn(`[serial] dropped malformed frame (${reason}): ${preview}`)
    return null
  }
}

/** Mirror of studio-web's `putConfigTimeoutMs`. */
export function putConfigTimeoutMs(payloadBytes: number): number {
  const sizeKB = payloadBytes / BYTES_PER_KB
  const scaled = Math.ceil(sizeKB * PUT_CONFIG_PER_KB_MS) + PUT_CONFIG_BASE_TIMEOUT_MS
  return Math.min(PUT_CONFIG_MAX_TIMEOUT_MS, Math.max(PUT_CONFIG_BASE_TIMEOUT_MS, scaled))
}

export class SerialClient {
  private port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null
  private readLoop: Promise<void> | null = null
  private rxBuffer = ''
  private readonly decoder = new TextDecoder()
  private readonly encoder = new TextEncoder()
  private readonly baudRate: number

  private status: SerialStatus = 'disconnected'
  private intentionalDisconnect = false
  /** Suppress reconnect during a deliberate port swap (second connect() call). */
  private suppressNextReconnect = false
  private pendingAck: PendingAck | null = null
  private pendingSends: QueuedSend[] = []
  private subscriptions: Subscription[] = []
  private statusListeners: StatusListener[] = []
  private activityListeners: ActivityListener[] = []
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = RECONNECT_INITIAL_MS
  private successUptimeStartedAt: number | null = null
  private lastError: string | undefined
  private readonly autoReconnect: boolean

  constructor(opts: SerialClientOptions = {}) {
    this.baudRate = opts.baudRate ?? DEFAULT_BAUD_RATE
    this.autoReconnect = !opts.disableReconnect
  }

  getStatus(): SerialStatus {
    return this.status
  }

  getPort(): SerialPort | null {
    return this.port
  }

  onStatus(listener: StatusListener): Unsubscribe {
    this.statusListeners.push(listener)
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener)
    }
  }

  /**
   * Subscribe to per-frame TX/RX ticks — fires once per successful write
   * and once per inbound frame that survives the JSON parse gate. Header
   * uses this to pulse the status dot like a hardware activity LED so the
   * user has an at-a-glance signal that bytes are still flowing.
   */
  onActivity(listener: ActivityListener): Unsubscribe {
    this.activityListeners.push(listener)
    return () => {
      this.activityListeners = this.activityListeners.filter((l) => l !== listener)
    }
  }

  private emitActivity(direction: SerialActivityDirection): void {
    for (const listener of this.activityListeners) listener(direction)
  }

  subscribe<T = unknown>(discriminator: string, handler: Handler<T>): Unsubscribe {
    const entry: Subscription = { discriminator, handler: handler as Handler<unknown> }
    this.subscriptions.push(entry)
    return () => {
      this.subscriptions = this.subscriptions.filter((s) => s !== entry)
    }
  }

  /**
   * Open the given SerialPort. If `port` is omitted, prompts the user via
   * `navigator.serial.requestPort()`. A second `connect()` call closes the
   * previous port first so only one is open at a time.
   */
  async connect(port?: SerialPort): Promise<void> {
    this.intentionalDisconnect = false
    this.cancelReconnect()
    this.reconnectDelay = RECONNECT_INITIAL_MS
    this.successUptimeStartedAt = null

    // Close any previously-open port so we never juggle two readers at once.
    if (this.port) {
      this.suppressNextReconnect = true
      await this.teardownPort()
    }

    const target = port ?? (await this.requestPort())
    if (!target) {
      const msg = 'no_port_selected'
      this.lastError = msg
      this.setStatus('disconnected', msg)
      throw new Error(msg)
    }

    return this.openPort(target)
  }

  /** Close the port and stop reconnecting. */
  disconnect(): void {
    this.intentionalDisconnect = true
    this.cancelReconnect()
    this.failPendingAck('disconnected')
    this.drainQueueWithError('disconnected')
    void this.teardownPort().finally(() => {
      this.setStatus('disconnected')
    })
  }

  /**
   * Send a command frame and await the firmware's ack. Queues if an ack is
   * already in flight; caps the queue at SEND_QUEUE_CAPACITY.
   */
  send(cmd: number, fields: Record<string, unknown> = {}, opts: SendOptions = {}): Promise<AckResult> {
    if (!this.writer || this.status !== 'connected') {
      return Promise.resolve({ ok: false, error: 'not_connected' })
    }
    if (this.pendingAck) {
      if (this.pendingSends.length >= SEND_QUEUE_CAPACITY) {
        return Promise.resolve({ ok: false, error: 'queue_full' })
      }
      return new Promise<AckResult>((resolve) => {
        this.pendingSends.push({ cmd, fields, opts, resolve })
      })
    }
    return this.dispatchSend(cmd, fields, opts)
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async requestPort(): Promise<SerialPort | null> {
    if (typeof navigator === 'undefined' || !navigator.serial) {
      throw new Error('webserial_unavailable')
    }
    try {
      return await navigator.serial.requestPort()
    } catch {
      // User cancelled the chooser — surface as no_port_selected.
      return null
    }
  }

  private async openPort(port: SerialPort): Promise<void> {
    this.setStatus(this.reconnectDelay > RECONNECT_INITIAL_MS ? 'reconnecting' : 'connecting')
    try {
      await port.open({ baudRate: this.baudRate })
    } catch (err) {
      // A failed `open()` here means the port was never established — usually
      // it's held exclusive by another consumer (PlatformIO Monitor, Arduino
      // IDE, `screen`, another browser tab). Retrying every 500 ms would flap
      // the UI between "Reconnecting…" and "Disconnected" forever without ever
      // succeeding. Park in disconnected with the friendly error and let the
      // user free the port + click Connect again.
      const raw = err instanceof Error ? err.message : 'open_failed'
      const msg = humanizeOpenError(raw)
      this.lastError = msg
      this.setStatus('disconnected', msg)
      throw new Error(msg)
    }

    if (!port.readable || !port.writable) {
      const msg = 'streams_unavailable'
      this.lastError = msg
      this.setStatus('disconnected', msg)
      await this.safeClose(port)
      throw new Error(msg)
    }

    const reader = port.readable.getReader()
    const writer = port.writable.getWriter()
    this.port = port
    this.reader = reader
    this.writer = writer
    this.rxBuffer = ''
    this.successUptimeStartedAt = Date.now()
    this.lastError = undefined
    this.setStatus('connected')

    // Fire-and-forget — the loop owns its own teardown via `handleClose`.
    this.readLoop = this.runReadLoop(port, reader).catch(() => undefined)
  }

  private async runReadLoop(
    ownPort: SerialPort,
    reader: ReadableStreamDefaultReader<Uint8Array>
  ): Promise<void> {
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        if (value && value.byteLength > 0) {
          this.rxBuffer += this.decoder.decode(value, { stream: true })
          this.drainFrames()
        }
      }
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'read_error'
    } finally {
      // Flush any trailing buffered bytes once the stream is closed.
      const tail = this.decoder.decode()
      if (tail) this.rxBuffer += tail
      this.drainFrames()
      // Only treat this as a connection close if we still own the port. A
      // deliberate `connect(other)` swap may have already wired up a new port
      // — don't clobber its state.
      if (this.port === ownPort || this.port === null) {
        this.handleClose(ownPort)
      }
    }
  }

  private drainFrames(): void {
    let nl = this.rxBuffer.indexOf('\n')
    while (nl !== -1) {
      const line = this.rxBuffer.slice(0, nl).replace(/\r$/, '')
      this.rxBuffer = this.rxBuffer.slice(nl + 1)
      if (line.length > 0) this.onFrame(line)
      nl = this.rxBuffer.indexOf('\n')
    }
  }

  private onFrame(raw: string): void {
    const parsed = safeJsonParse(raw)
    if (!isRecord(parsed)) return
    this.emitActivity('rx')

    // Ack path first — a `{status, log}` ack must not be swallowed by `log`
    // subscribers (matches studio-web's #1288 WS-4 fix).
    if ('status' in parsed && this.pendingAck) {
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
      this.drainPendingSends()
      return
    }

    for (const sub of this.subscriptions) {
      if (sub.discriminator in parsed) {
        sub.handler(parsed)
        return
      }
    }
  }

  private dispatchSend(
    cmd: number,
    fields: Record<string, unknown>,
    opts: SendOptions
  ): Promise<AckResult> {
    const payload = JSON.stringify({ cmd, ...fields }) + '\n'
    const timeoutMs = opts.scaleWithPayload
      ? putConfigTimeoutMs(payload.length)
      : (opts.timeoutMs ?? ACK_TIMEOUT_MS)

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingAck = null
        resolve({ ok: false, error: 'ack_timeout' })
        this.drainPendingSends()
      }, timeoutMs)

      this.pendingAck = { resolve, timer }

      const writer = this.writer
      if (!writer) {
        clearTimeout(timer)
        this.pendingAck = null
        resolve({ ok: false, error: 'not_connected' })
        this.drainPendingSends()
        return
      }

      writer
        .write(this.encoder.encode(payload))
        .then(() => {
          this.emitActivity('tx')
        })
        .catch((err: unknown) => {
          clearTimeout(timer)
          this.pendingAck = null
          const msg = err instanceof Error ? err.message : 'send_failed'
          resolve({ ok: false, error: msg })
          this.drainPendingSends()
        })
    })
  }

  private drainPendingSends(): void {
    if (this.pendingAck) return
    const next = this.pendingSends.shift()
    if (!next) return
    if (!this.writer || this.status !== 'connected') {
      next.resolve({ ok: false, error: 'not_connected' })
      this.drainPendingSends()
      return
    }
    void this.dispatchSend(next.cmd, next.fields, next.opts).then(next.resolve)
  }

  private drainQueueWithError(reason: string): void {
    const pending = this.pendingSends
    this.pendingSends = []
    for (const entry of pending) entry.resolve({ ok: false, error: reason })
  }

  private failPendingAck(reason: string): void {
    if (!this.pendingAck) return
    const ack = this.pendingAck
    this.pendingAck = null
    clearTimeout(ack.timer)
    ack.resolve({ ok: false, error: reason })
  }

  private handleClose(ownPort: SerialPort): void {
    void this.safeClose(ownPort)

    // A deliberate `connect(other)` swap is mid-flight or has already rewired
    // state to a new port — don't touch pending state or schedule a reconnect.
    if (this.suppressNextReconnect || (this.port !== null && this.port !== ownPort)) {
      this.suppressNextReconnect = false
      return
    }

    this.failPendingAck('connection_closed')
    this.drainQueueWithError('connection_closed')
    const wasConnected = this.status === 'connected'
    const openedAt = this.successUptimeStartedAt
    this.successUptimeStartedAt = null
    this.reader = null
    this.writer = null
    this.port = null
    this.readLoop = null

    if (this.intentionalDisconnect) {
      this.setStatus('disconnected')
      return
    }
    const reason = this.lastError ?? 'connection_closed'
    this.setStatus('disconnected', reason)
    if (wasConnected || this.reconnectDelay > RECONNECT_INITIAL_MS) {
      if (openedAt !== null && Date.now() - openedAt >= STABLE_UPTIME_MS) {
        this.reconnectDelay = RECONNECT_INITIAL_MS
      }
      this.scheduleReconnect(ownPort)
    }
  }

  private scheduleReconnect(port: SerialPort | null): void {
    if (!this.autoReconnect || this.intentionalDisconnect) return
    if (this.reconnectTimer) return
    if (!port) return

    this.setStatus('reconnecting', this.lastError)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.reconnectDelay = Math.min(this.reconnectDelay * RECONNECT_FACTOR, RECONNECT_MAX_MS)
      void this.openPort(port).catch(() => undefined)
    }, this.reconnectDelay)
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private async teardownPort(): Promise<void> {
    // Release reader/writer so `port.close()` can complete. Cancelling the
    // reader will cause `runReadLoop` to exit and call `handleClose`.
    const reader = this.reader
    const writer = this.writer
    const port = this.port
    this.reader = null
    this.writer = null
    this.port = null

    if (reader) {
      try {
        await reader.cancel()
      } catch {
        // Ignore — reader may already be closed.
      }
      try {
        reader.releaseLock()
      } catch {
        // Ignore.
      }
    }
    if (writer) {
      try {
        await writer.close()
      } catch {
        // Ignore — writer may already be closed.
      }
      try {
        writer.releaseLock()
      } catch {
        // Ignore.
      }
    }
    if (port) await this.safeClose(port)
  }

  private async safeClose(port: SerialPort): Promise<void> {
    try {
      await port.close()
    } catch {
      // Ignore — `close` throws when streams are still locked or never opened.
    }
  }

  private setStatus(next: SerialStatus, error?: string): void {
    if (this.status === next && this.lastError === error) return
    this.status = next
    if (error !== undefined) this.lastError = error
    for (const listener of this.statusListeners) {
      try {
        listener(next, this.lastError)
      } catch {
        // Swallow listener errors — one bad consumer must not poison others.
      }
    }
  }
}

let singleton: SerialClient | null = null

export function getSerialClient(): SerialClient {
  if (!singleton) singleton = new SerialClient()
  return singleton
}

/** Reset the singleton — test-only. */
export function __resetSerialClientSingleton(): void {
  if (singleton) singleton.disconnect()
  singleton = null
}

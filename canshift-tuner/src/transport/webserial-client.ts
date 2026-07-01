const DEFAULT_BAUD_RATE = 115_200

const ACK_TIMEOUT_MS = 5_000
const PUT_CONFIG_BASE_TIMEOUT_MS = ACK_TIMEOUT_MS
const PUT_CONFIG_PER_KB_MS = 50
const PUT_CONFIG_MAX_TIMEOUT_MS = 60_000
const BYTES_PER_KB = 1024

const RECONNECT_INITIAL_MS = 500
const RECONNECT_MAX_MS = 30_000
const RECONNECT_FACTOR = 2

const STALE_ACK_FLUSH_MS = 1_000

const STABLE_UPTIME_MS = 10_000

const SEND_QUEUE_CAPACITY = 8

export type SerialStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

const humanizeOpenError = (raw: string): string => {
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
  disableReconnect?: boolean
}

export interface SendOptions {
  timeoutMs?: number
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const safeJsonParse = (line: string): unknown => {
  const trimmed = line.trim()
  if (trimmed.length === 0 || !trimmed.startsWith('{')) return null
  try {
    return JSON.parse(trimmed) as unknown
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown'
    const preview = trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed
    console.warn(`[serial] dropped malformed frame (${reason}): ${preview}`)
    return null
  }
}

export const putConfigTimeoutMs = (payloadBytes: number): number => {
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
  private suppressNextReconnect = false
  private pendingAck: PendingAck | null = null
  private pendingSends: QueuedSend[] = []
  private subscriptions: Subscription[] = []
  private statusListeners: StatusListener[] = []
  private activityListeners: ActivityListener[] = []
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = RECONNECT_INITIAL_MS
  private staleAckDiscards = 0
  private staleAckFlushTimer: ReturnType<typeof setTimeout> | null = null
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

  async connect(port?: SerialPort): Promise<void> {
    this.intentionalDisconnect = false
    this.cancelReconnect()
    this.reconnectDelay = RECONNECT_INITIAL_MS
    this.successUptimeStartedAt = null

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

  disconnect(): void {
    this.intentionalDisconnect = true
    this.cancelReconnect()
    this.failPendingAck('disconnected')
    this.clearStaleAckFlush()
    this.drainQueueWithError('disconnected')
    const reader = this.reader
    const readLoopPromise = this.readLoop
    if (reader) {
      reader.cancel().catch(() => undefined)
    }
    void (readLoopPromise ?? Promise.resolve()).finally(() => {
      this.setStatus('disconnected')
    })
  }

  send(
    cmd: number,
    fields: Record<string, unknown> = {},
    opts: SendOptions = {}
  ): Promise<AckResult> {
    if (!this.writer || this.status !== 'connected') {
      return Promise.resolve({ ok: false, error: 'not_connected' })
    }
    if (this.pendingAck || this.staleAckDiscards > 0) {
      if (this.pendingSends.length >= SEND_QUEUE_CAPACITY) {
        return Promise.resolve({ ok: false, error: 'queue_full' })
      }
      return new Promise<AckResult>((resolve) => {
        this.pendingSends.push({ cmd, fields, opts, resolve })
      })
    }
    return this.dispatchSend(cmd, fields, opts)
  }

  private async deassertResetSignals(port: SerialPort): Promise<void> {
    const setSignals = (
      port as {
        setSignals?: (signals: {
          dataTerminalReady?: boolean
          requestToSend?: boolean
        }) => Promise<void>
      }
    ).setSignals
    if (typeof setSignals !== 'function') return
    try {
      await setSignals.call(port, { dataTerminalReady: false, requestToSend: false })
    } catch (err) {
      console.warn('[serial] setSignals failed', err)
    }
  }

  private async requestPort(): Promise<SerialPort | null> {
    if (typeof navigator === 'undefined' || !navigator.serial) {
      throw new Error('webserial_unavailable')
    }
    try {
      return await navigator.serial.requestPort()
    } catch {
      return null
    }
  }

  private async openPort(port: SerialPort): Promise<void> {
    this.setStatus(this.reconnectDelay > RECONNECT_INITIAL_MS ? 'reconnecting' : 'connecting')
    try {
      await port.open({ baudRate: this.baudRate })
      await this.deassertResetSignals(port)
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'open_failed'
      const msg = humanizeOpenError(raw)
      this.lastError = msg
      this.setStatus('disconnected', msg)
      throw new Error(msg, { cause: err })
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
    this.clearStaleAckFlush()
    this.successUptimeStartedAt = Date.now()
    this.lastError = undefined
    this.setStatus('connected')

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
      const tail = this.decoder.decode()
      if (tail) this.rxBuffer += tail
      this.drainFrames()
      try {
        await reader.cancel()
      } catch (err) {
        console.warn('[serial] reader.cancel after readLoop failed', err)
      }
      try {
        reader.releaseLock()
      } catch (err) {
        console.warn('[serial] reader.releaseLock after readLoop failed', err)
      }
      const writerSnapshot = this.writer
      if (writerSnapshot) {
        try {
          await writerSnapshot.abort()
        } catch (err) {
          console.warn('[serial] writer.abort after readLoop failed', err)
        }
        try {
          writerSnapshot.releaseLock()
        } catch (err) {
          console.warn('[serial] writer.releaseLock after abort failed', err)
        }
      }
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

    if ('status' in parsed) {
      if (this.staleAckDiscards > 0) {
        console.warn('[serial] discarded stale status frame after ack_timeout')
        this.consumeStaleAck()
        return
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
        this.drainPendingSends()
        return
      }
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
        this.beginStaleAckFlush()
        resolve({ ok: false, error: 'ack_timeout' })
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
    if (this.pendingAck || this.staleAckDiscards > 0) return
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

  private beginStaleAckFlush(): void {
    this.staleAckDiscards += 1
    if (this.staleAckFlushTimer) clearTimeout(this.staleAckFlushTimer)
    this.staleAckFlushTimer = setTimeout(() => {
      this.staleAckFlushTimer = null
      this.staleAckDiscards = 0
      this.drainPendingSends()
    }, STALE_ACK_FLUSH_MS)
  }

  private consumeStaleAck(): void {
    this.staleAckDiscards -= 1
    if (this.staleAckDiscards > 0) return
    this.clearStaleAckFlush()
    this.drainPendingSends()
  }

  private clearStaleAckFlush(): void {
    this.staleAckDiscards = 0
    if (this.staleAckFlushTimer) {
      clearTimeout(this.staleAckFlushTimer)
      this.staleAckFlushTimer = null
    }
  }

  private failPendingAck(reason: string): void {
    if (!this.pendingAck) return
    const ack = this.pendingAck
    this.pendingAck = null
    clearTimeout(ack.timer)
    ack.resolve({ ok: false, error: reason })
  }

  private handleClose(ownPort: SerialPort): void {
    const reader = this.reader
    if (reader) {
      try {
        reader.releaseLock()
      } catch (err) {
        console.warn('[serial] reader.releaseLock failed', err)
      }
    }
    const writer = this.writer
    if (writer) {
      try {
        writer.releaseLock()
      } catch (err) {
        console.warn('[serial] writer.releaseLock failed', err)
      }
    }
    void this.safeClose(ownPort)

    if (this.suppressNextReconnect || (this.port !== null && this.port !== ownPort)) {
      this.suppressNextReconnect = false
      return
    }

    this.failPendingAck('connection_closed')
    this.clearStaleAckFlush()
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
      void this.openPort(port).catch(() => {
        this.scheduleReconnect(port)
      })
    }, this.reconnectDelay)
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private async teardownPort(): Promise<void> {
    const reader = this.reader
    const writer = this.writer
    const port = this.port
    this.reader = null
    this.writer = null
    this.port = null

    if (reader) {
      try {
        await reader.cancel()
      } catch (err) {
        console.warn('[serial] reader.cancel failed', err)
      }
      try {
        reader.releaseLock()
      } catch (err) {
        console.warn('[serial] reader.releaseLock failed', err)
      }
    }
    if (writer) {
      try {
        await writer.close()
      } catch (err) {
        console.warn('[serial] writer.close failed', err)
      }
      try {
        writer.releaseLock()
      } catch (err) {
        console.warn('[serial] writer.releaseLock failed', err)
      }
    }
    if (port) await this.safeClose(port)
  }

  private async safeClose(port: SerialPort): Promise<void> {
    try {
      await port.close()
    } catch (err) {
      console.warn('[serial] port.close failed', err)
    }
  }

  private setStatus(next: SerialStatus, error?: string): void {
    if (this.status === next && this.lastError === error) return
    this.status = next
    if (error !== undefined) this.lastError = error
    for (const listener of this.statusListeners) {
      try {
        listener(next, this.lastError)
      } catch (err) {
        console.warn('[serial] status listener threw', err)
      }
    }
  }
}

let singleton: SerialClient | null = null

export const getSerialClient = (): SerialClient => {
  singleton ??= new SerialClient()
  return singleton
}

export const __resetSerialClientSingleton = (): void => {
  if (singleton) singleton.disconnect()
  singleton = null
}

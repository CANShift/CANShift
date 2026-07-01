import { useDeviceStore } from '../stores/device.store'
import { useReconnectStore } from '../stores/reconnect.store'
import { log } from '../stores/log.store'

const RECONNECT_INITIAL_DELAY_MS = 1_000
const RECONNECT_MAX_DELAY_MS = 30_000
const RECONNECT_BACKOFF_FACTOR = 2
const RECONNECT_JITTER_RATIO = 0.2
const RECONNECT_MAX_ATTEMPTS = 6
const RECONNECT_SCAN_TIMEOUT_MS = 5_000

export const computeBackoffDelay = (attempt: number): number => {
  const exponential = RECONNECT_INITIAL_DELAY_MS * Math.pow(RECONNECT_BACKOFF_FACTOR, attempt)
  const capped = Math.min(exponential, RECONNECT_MAX_DELAY_MS)
  const jitter = capped * RECONNECT_JITTER_RATIO * (Math.random() * 2 - 1)
  return Math.max(0, Math.round(capped + jitter))
}

const isAborted = (signal: AbortSignal): boolean => {
  return signal.aborted
}

export const sleepWithAbort = (ms: number, signal: AbortSignal): Promise<void> => {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve()
      return
    }
    const handle = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(handle)
      signal.removeEventListener('abort', onAbort)
      resolve()
    }
    signal.addEventListener('abort', onAbort)
  })
}

export interface BleReconnectDeps {
  connect: (deviceId: string) => Promise<void>
  startScan: (onResult: (error: unknown, deviceId: string | null) => void) => void
  stopScan: () => void
}

export class BleReconnector {
  private controller: AbortController | null = null

  constructor(private readonly deps: BleReconnectDeps) {}

  cancel(): void {
    if (this.controller) {
      this.controller.abort()
      this.controller = null
    }
    this.deps.stopScan()
    useReconnectStore.getState().stop()
  }

  private async tryConnectAttempt(
    deviceId: string,
    attempt: number,
    signal: AbortSignal
  ): Promise<'aborted' | 'connected' | 'failed'> {
    try {
      await this.deps.connect(deviceId)
      if (isAborted(signal)) return 'aborted'
      log('info', `Auto-reconnect: succeeded on attempt ${String(attempt)}`)
      return 'connected'
    } catch (err) {
      if (isAborted(signal)) return 'aborted'
      const msg = err instanceof Error ? err.message : 'unknown error'
      log('warn', `Auto-reconnect: connect failed on attempt ${String(attempt)}: ${msg}`)
      return 'failed'
    }
  }

  async run(deviceId: string): Promise<void> {
    if (this.controller) {
      log('warn', 'Reconnect loop already running — ignoring duplicate trigger')
      return
    }

    const controller = new AbortController()
    this.controller = controller
    const { signal } = controller
    const reconnectStore = useReconnectStore.getState()
    reconnectStore.start(deviceId, RECONNECT_MAX_ATTEMPTS)

    log('info', `Auto-reconnect: starting for ${deviceId}`)

    try {
      for (let attempt = 1; attempt <= RECONNECT_MAX_ATTEMPTS; attempt++) {
        if (isAborted(signal)) return

        const delay = computeBackoffDelay(attempt - 1)
        useReconnectStore.getState().setAttempt(attempt)
        log(
          'info',
          `Auto-reconnect: attempt ${String(attempt)}/${String(RECONNECT_MAX_ATTEMPTS)} in ${String(delay)}ms`
        )
        await sleepWithAbort(delay, signal)
        if (isAborted(signal)) return

        const found = await this.scanForDevice(deviceId, signal)
        if (isAborted(signal)) return
        if (!found) {
          log('warn', `Auto-reconnect: device ${deviceId} not seen on attempt ${String(attempt)}`)
          continue
        }

        const outcome = await this.tryConnectAttempt(deviceId, attempt, signal)
        if (outcome === 'aborted' || outcome === 'connected') return
      }

      if (!isAborted(signal)) {
        log('error', 'Auto-reconnect: max attempts reached, giving up')
        useDeviceStore.getState().setError({ kind: 'not-in-range' })
      }
    } finally {
      if (this.controller === controller) {
        this.controller = null
      }
      useReconnectStore.getState().stop()
    }
  }

  private scanForDevice(deviceId: string, signal: AbortSignal): Promise<boolean> {
    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve(false)
        return
      }

      let settled = false
      const finish = (found: boolean) => {
        if (settled) return
        settled = true
        this.deps.stopScan()
        signal.removeEventListener('abort', onAbort)
        clearTimeout(timer)
        resolve(found)
      }
      const onAbort = () => {
        finish(false)
      }
      signal.addEventListener('abort', onAbort)

      const timer = setTimeout(() => {
        finish(false)
      }, RECONNECT_SCAN_TIMEOUT_MS)

      this.deps.startScan((error, foundDeviceId) => {
        if (error) {
          finish(false)
          return
        }
        if (foundDeviceId === deviceId) {
          finish(true)
        }
      })
    })
  }
}

import { BleReconnector, computeBackoffDelay, sleepWithAbort } from './ble-reconnect'
import { useReconnectStore } from '../stores/reconnect.store'

const flush = (): Promise<void> => {
  return new Promise((resolve) => {
    setImmediate(resolve)
  })
}

describe('computeBackoffDelay', () => {
  it('stays within the jittered exponential bounds for the first attempt', () => {
    for (let i = 0; i < 50; i++) {
      const delay = computeBackoffDelay(0)
      expect(delay).toBeGreaterThanOrEqual(800)
      expect(delay).toBeLessThanOrEqual(1200)
    }
  })

  it('caps large attempts at the max delay plus jitter', () => {
    for (let i = 0; i < 50; i++) {
      const delay = computeBackoffDelay(10)
      expect(delay).toBeGreaterThanOrEqual(24_000)
      expect(delay).toBeLessThanOrEqual(36_000)
    }
  })
})

describe('sleepWithAbort', () => {
  it('resolves immediately when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(sleepWithAbort(60_000, controller.signal)).resolves.toBeUndefined()
  })
})

describe('BleReconnector', () => {
  afterEach(() => {
    jest.useRealTimers()
    useReconnectStore.getState().stop()
  })

  it('connects once the device is seen during a reconnect scan', async () => {
    jest.useFakeTimers()
    const connect = jest.fn(() => Promise.resolve())
    const startScan = jest.fn((onResult: (error: unknown, deviceId: string | null) => void) => {
      onResult(null, 'dev-1')
    })
    const stopScan = jest.fn()
    const reconnector = new BleReconnector({ connect, startScan, stopScan })

    const loop = reconnector.run('dev-1')
    await jest.advanceTimersByTimeAsync(2_000)
    await loop

    expect(connect).toHaveBeenCalledTimes(1)
    expect(connect).toHaveBeenCalledWith('dev-1')
    expect(stopScan).toHaveBeenCalled()
    expect(useReconnectStore.getState().isReconnecting).toBe(false)
  })

  it('cancel aborts a pending loop before any connect attempt', async () => {
    const connect = jest.fn(() => Promise.resolve())
    const startScan = jest.fn()
    const stopScan = jest.fn()
    const reconnector = new BleReconnector({ connect, startScan, stopScan })

    const loop = reconnector.run('dev-1')
    await flush()
    reconnector.cancel()
    await loop

    expect(connect).not.toHaveBeenCalled()
    expect(stopScan).toHaveBeenCalled()
    expect(useReconnectStore.getState().isReconnecting).toBe(false)
  })

  it('ignores a duplicate run while a loop is already active', async () => {
    const connect = jest.fn(() => Promise.resolve())
    const startScan = jest.fn()
    const stopScan = jest.fn()
    const reconnector = new BleReconnector({ connect, startScan, stopScan })

    const first = reconnector.run('dev-1')
    await flush()
    const attemptBefore = useReconnectStore.getState().attempt
    await reconnector.run('dev-1')
    expect(useReconnectStore.getState().attempt).toBe(attemptBefore)

    reconnector.cancel()
    await first
  })
})

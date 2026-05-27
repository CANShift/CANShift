// ble.retry.test.ts — withGattRetry transient/non-transient paths

import { withGattRetry } from './ble.retry'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('withGattRetry', () => {
  it('returns result immediately when op succeeds on first try', async () => {
    const op = jest.fn().mockResolvedValue('ok')
    const result = await withGattRetry(op)
    expect(result).toBe('ok')
    expect(op).toHaveBeenCalledTimes(1)
  })

  it('retries once on a transient GATT error then returns success', async () => {
    const op = jest
      .fn()
      .mockRejectedValueOnce(new Error('GATT_BUSY: write failed'))
      .mockResolvedValueOnce('ok')

    const promise = withGattRetry(op, { retries: 1, backoffMs: 500 })
    // Advance past the backoff so the retry fires.
    await jest.runAllTimersAsync()
    const result = await promise

    expect(result).toBe('ok')
    expect(op).toHaveBeenCalledTimes(2)
  })

  it('throws immediately on a non-transient error without retrying', async () => {
    const op = jest.fn().mockRejectedValue(new Error('Not connected'))

    await expect(withGattRetry(op)).rejects.toThrow('Not connected')
    expect(op).toHaveBeenCalledTimes(1)
  })

  it('throws after exhausting all retries on a persistent transient error', async () => {
    const transientErr = new Error('timed out waiting for GATT response')
    const op = jest.fn().mockRejectedValue(transientErr)

    // Attach rejects assertion before advancing timers to avoid unhandled rejection.
    const assertion = expect(withGattRetry(op, { retries: 2, backoffMs: 100 })).rejects.toThrow(
      'timed out waiting for GATT response'
    )

    await jest.runAllTimersAsync()
    await assertion

    // retries=2 → 3 total attempts (attempt 0, 1, 2)
    expect(op).toHaveBeenCalledTimes(3)
  })
})

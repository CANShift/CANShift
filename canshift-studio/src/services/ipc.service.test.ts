// ipc.service.test.ts — covers the timeout wrapper around window.ipc.invoke().
//
// We don't test individual service objects (configService, usbService, …) — they
// are thin pass-throughs. The interesting behaviour lives in invokeWithTimeout()
// + IpcTimeoutError and is exercised here against a stubbed window.ipc bridge.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { invokeWithTimeout, IpcTimeoutError } from './ipc.service'

interface IpcStub {
  invoke: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  channels: Record<string, string>
}

function installIpcStub(invokeImpl: (...args: unknown[]) => Promise<unknown>): IpcStub {
  const stub: IpcStub = {
    invoke: vi.fn(invokeImpl),
    send: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    channels: {},
  }
  // Cast through unknown — the global Window type ships richer fields we don't
  // need to satisfy the bridge contract used by ipc.service.
  ;(window as unknown as { ipc: IpcStub }).ipc = stub
  return stub
}

describe('invokeWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('resolves with the handler value when it answers before the timeout', async () => {
    installIpcStub(() => Promise.resolve('payload'))

    const promise = invokeWithTimeout<string>('test:channel', [], 1_000)

    await expect(promise).resolves.toBe('payload')
  })

  it('rejects with IpcTimeoutError when the handler hangs past the timeout', async () => {
    // Promise that never settles — simulates a hung main-side handler.
    installIpcStub(
      () =>
        new Promise<unknown>(() => {
          /* never resolves */
        })
    )

    const promise = invokeWithTimeout('test:hang', [], 5_000)
    // Fake-timer aware: advance past the timeout so setTimeout fires.
    void vi.advanceTimersByTimeAsync(5_001)

    await expect(promise).rejects.toBeInstanceOf(IpcTimeoutError)
    await promise.catch((err: unknown) => {
      if (!(err instanceof IpcTimeoutError)) throw err
      expect(err.channel).toBe('test:hang')
      expect(err.timeoutMs).toBe(5_000)
      expect(err.name).toBe('IpcTimeoutError')
      expect(err.message).toContain('test:hang')
      expect(err.message).toContain('5000')
    })
  })

  it('propagates handler-thrown errors unchanged (not wrapped in IpcTimeoutError)', async () => {
    const original = new Error('boom')
    installIpcStub(() => Promise.reject(original))

    const promise = invokeWithTimeout('test:err', [], 1_000)

    await expect(promise).rejects.toBe(original)
  })

  it('forwards args to window.ipc.invoke', async () => {
    const stub = installIpcStub(() => Promise.resolve(null))

    await invokeWithTimeout('test:args', ['a', 42, { k: 'v' }], 1_000)

    expect(stub.invoke).toHaveBeenCalledWith('test:args', 'a', 42, { k: 'v' })
  })
})

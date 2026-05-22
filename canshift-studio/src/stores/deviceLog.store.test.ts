// deviceLog.store.test.ts — Behaviour contract for the single USB_DEVICE_LOG
// funnel (audit S-M-2, umbrella #1015). Covers ring-buffer append + cap,
// per-entry fan-out, `bootLogVersion` derivation, malformed payload filtering,
// and lifecycle (`start`/`stop` idempotency, listener identity).
//
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DeviceLogPayload } from '../services/ipc.service'
import { IpcChannels } from '../../shared/ipc-channels'
import {
  MAX_ENTRIES,
  _resetDeviceLogStoreForTest,
  selectBootLogVersion,
  selectDeviceLogEntries,
  useDeviceLogStore,
} from './deviceLog.store'

interface IpcStub {
  invoke: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  channels: Record<string, string>
}

const listeners = new Map<string, ((...args: unknown[]) => void)[]>()

function dispatch(channel: string, payload: unknown): void {
  const list = listeners.get(channel) ?? []
  for (const handler of list.slice()) {
    handler(payload)
  }
}

function makeEntry(overrides: Partial<DeviceLogPayload> = {}): DeviceLogPayload {
  return {
    level: 'I',
    tag: 'GEN',
    message: 'hello',
    ...overrides,
  }
}

beforeEach(() => {
  listeners.clear()
  _resetDeviceLogStoreForTest()
  const stub: IpcStub = {
    invoke: vi.fn(() => Promise.resolve(undefined)),
    send: vi.fn(),
    on: vi.fn((channel: string, handler: (...args: unknown[]) => void) => {
      const list = listeners.get(channel) ?? []
      list.push(handler)
      listeners.set(channel, list)
    }),
    off: vi.fn((channel: string, handler: (...args: unknown[]) => void) => {
      const list = listeners.get(channel)
      if (!list) return
      const idx = list.indexOf(handler)
      if (idx !== -1) list.splice(idx, 1)
    }),
    channels: IpcChannels,
  }
  Object.defineProperty(window, 'ipc', {
    configurable: true,
    writable: true,
    value: stub,
  })
})

afterEach(() => {
  _resetDeviceLogStoreForTest()
})

describe('deviceLog.store — IPC lifecycle', () => {
  it('start() mounts exactly one USB_DEVICE_LOG IPC listener', () => {
    useDeviceLogStore.getState().start()
    expect(listeners.get(IpcChannels.USB_DEVICE_LOG)?.length).toBe(1)
  })

  it('start() is idempotent — calling twice does NOT add a second listener', () => {
    useDeviceLogStore.getState().start()
    useDeviceLogStore.getState().start()
    expect(listeners.get(IpcChannels.USB_DEVICE_LOG)?.length).toBe(1)
  })

  it('stop() unregisters the IPC listener', () => {
    useDeviceLogStore.getState().start()
    expect(listeners.get(IpcChannels.USB_DEVICE_LOG)?.length).toBe(1)
    useDeviceLogStore.getState().stop()
    expect(listeners.get(IpcChannels.USB_DEVICE_LOG)?.length).toBe(0)
  })
})

describe('deviceLog.store — ring-buffer append + cap', () => {
  it('appends valid payloads in arrival order', () => {
    useDeviceLogStore.getState().start()
    dispatch(IpcChannels.USB_DEVICE_LOG, makeEntry({ message: 'a' }))
    dispatch(IpcChannels.USB_DEVICE_LOG, makeEntry({ message: 'b' }))
    dispatch(IpcChannels.USB_DEVICE_LOG, makeEntry({ message: 'c' }))

    const entries = selectDeviceLogEntries(useDeviceLogStore.getState())
    expect(entries.map((e) => e.message)).toEqual(['a', 'b', 'c'])
  })

  it('caps the buffer at MAX_ENTRIES — oldest entries fall off the front', () => {
    useDeviceLogStore.getState().start()
    for (let i = 0; i < MAX_ENTRIES + 5; i++) {
      dispatch(IpcChannels.USB_DEVICE_LOG, makeEntry({ message: `m${String(i)}` }))
    }

    const entries = selectDeviceLogEntries(useDeviceLogStore.getState())
    expect(entries.length).toBe(MAX_ENTRIES)
    // First retained entry is `m5` (entries 0..4 fell off).
    expect(entries[0]?.message).toBe('m5')
    expect(entries.at(-1)?.message).toBe(`m${String(MAX_ENTRIES + 5 - 1)}`)
  })

  it('drops malformed payloads silently (no buffer growth)', () => {
    useDeviceLogStore.getState().start()
    dispatch(IpcChannels.USB_DEVICE_LOG, null)
    dispatch(IpcChannels.USB_DEVICE_LOG, { level: 'I' /* missing tag/message */ })
    dispatch(IpcChannels.USB_DEVICE_LOG, 'not-an-object')
    dispatch(IpcChannels.USB_DEVICE_LOG, 42)

    expect(selectDeviceLogEntries(useDeviceLogStore.getState())).toEqual([])
  })

  it('reset() clears the buffer and the parsed boot version', () => {
    useDeviceLogStore.getState().start()
    dispatch(
      IpcChannels.USB_DEVICE_LOG,
      makeEntry({ tag: 'BOOT', message: 'CANShift v0.8.0 starting' })
    )
    dispatch(IpcChannels.USB_DEVICE_LOG, makeEntry({ message: 'noise' }))
    expect(selectBootLogVersion(useDeviceLogStore.getState())).toBe('0.8.0')
    expect(selectDeviceLogEntries(useDeviceLogStore.getState()).length).toBe(2)

    useDeviceLogStore.getState().reset()
    expect(selectBootLogVersion(useDeviceLogStore.getState())).toBeNull()
    expect(selectDeviceLogEntries(useDeviceLogStore.getState())).toEqual([])
  })
})

describe('deviceLog.store — boot version derivation', () => {
  it('extracts the version from a `[BOOT] CANShift vX.Y.Z` banner', () => {
    useDeviceLogStore.getState().start()
    dispatch(
      IpcChannels.USB_DEVICE_LOG,
      makeEntry({ tag: 'BOOT', message: 'CANShift v1.2.3 starting' })
    )
    expect(selectBootLogVersion(useDeviceLogStore.getState())).toBe('1.2.3')
  })

  it('leaves bootLogVersion at the most recent banner across multiple boots', () => {
    useDeviceLogStore.getState().start()
    dispatch(
      IpcChannels.USB_DEVICE_LOG,
      makeEntry({ tag: 'BOOT', message: 'CANShift v0.7.0 starting' })
    )
    dispatch(
      IpcChannels.USB_DEVICE_LOG,
      makeEntry({ tag: 'BOOT', message: 'CANShift v0.8.0 starting' })
    )
    expect(selectBootLogVersion(useDeviceLogStore.getState())).toBe('0.8.0')
  })

  it('ignores non-BOOT tagged entries when parsing version', () => {
    useDeviceLogStore.getState().start()
    dispatch(
      IpcChannels.USB_DEVICE_LOG,
      makeEntry({ tag: 'APP', message: 'CANShift v9.9.9 starting' })
    )
    expect(selectBootLogVersion(useDeviceLogStore.getState())).toBeNull()
  })
})

describe('deviceLog.store — per-entry fan-out', () => {
  it('invokes registered subscribers once per valid entry, in registration order', () => {
    useDeviceLogStore.getState().start()
    const calls: string[] = []
    useDeviceLogStore.getState().subscribeEntry((entry) => {
      calls.push(`a:${entry.message}`)
    })
    useDeviceLogStore.getState().subscribeEntry((entry) => {
      calls.push(`b:${entry.message}`)
    })

    dispatch(IpcChannels.USB_DEVICE_LOG, makeEntry({ message: 'one' }))
    dispatch(IpcChannels.USB_DEVICE_LOG, makeEntry({ message: 'two' }))

    expect(calls).toEqual(['a:one', 'b:one', 'a:two', 'b:two'])
  })

  it('returns an unsubscribe function that removes the subscriber', () => {
    useDeviceLogStore.getState().start()
    const handler = vi.fn()
    const unsubscribe = useDeviceLogStore.getState().subscribeEntry(handler)

    dispatch(IpcChannels.USB_DEVICE_LOG, makeEntry({ message: 'one' }))
    expect(handler).toHaveBeenCalledTimes(1)

    unsubscribe()
    dispatch(IpcChannels.USB_DEVICE_LOG, makeEntry({ message: 'two' }))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('skips fan-out for malformed payloads', () => {
    useDeviceLogStore.getState().start()
    const handler = vi.fn()
    useDeviceLogStore.getState().subscribeEntry(handler)

    dispatch(IpcChannels.USB_DEVICE_LOG, null)
    dispatch(IpcChannels.USB_DEVICE_LOG, { level: 'I' })

    expect(handler).not.toHaveBeenCalled()
  })

  it('survives a subscriber that unsubscribes itself mid-dispatch', () => {
    useDeviceLogStore.getState().start()
    const calls: string[] = []
    let unsubscribeSelf: (() => void) | null = null
    const subA = useDeviceLogStore.getState().subscribeEntry((entry) => {
      calls.push(`a:${entry.message}`)
      unsubscribeSelf?.()
    })
    unsubscribeSelf = subA
    useDeviceLogStore.getState().subscribeEntry((entry) => {
      calls.push(`b:${entry.message}`)
    })

    dispatch(IpcChannels.USB_DEVICE_LOG, makeEntry({ message: 'one' }))
    dispatch(IpcChannels.USB_DEVICE_LOG, makeEntry({ message: 'two' }))

    // First dispatch reached both; second reached only b — a unsubscribed.
    expect(calls).toEqual(['a:one', 'b:one', 'b:two'])
  })
})

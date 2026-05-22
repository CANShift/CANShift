// useBootLoopDetector.test.tsx — Locks the contract for the boot-loop
// detector hook (#498). Mirrors the IPC stub infra used by
// `useUsbEvents.test.tsx`.
//
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { IpcChannels } from '../../shared/ipc-channels'
import { useDeviceStore } from '../stores/device.store'
import { CONTEXT_LINES, QUIET_RESET_MS, useBootLoopStore } from '../stores/bootLoop.store'
import { useBootLoopDetector } from './useBootLoopDetector'
import { _resetDeviceLogStoreForTest, useDeviceLogStore } from '../stores/deviceLog.store'

interface IpcStub {
  invoke: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  channels: Record<string, string>
}

const listeners = new Map<string, ((...args: unknown[]) => void)[]>()

function resetBootLoopStore(): void {
  useBootLoopStore.setState({
    looping: false,
    bootMarkers: [],
    lastVersion: null,
    lastBootContext: [],
    detectedAt: null,
    dismissedAt: null,
  })
}

function connectDevice(): void {
  useDeviceStore.getState().setConnected('/dev/test')
}

function disconnectDevice(): void {
  useDeviceStore.getState().setDisconnected()
}

beforeEach(() => {
  listeners.clear()
  _resetDeviceLogStoreForTest()
  resetBootLoopStore()
  disconnectDevice()
  const stub: IpcStub = {
    invoke: vi.fn(() => Promise.resolve(undefined)),
    send: vi.fn(),
    on: vi.fn((channel: string, listener: (...args: unknown[]) => void) => {
      const list = listeners.get(channel) ?? []
      list.push(listener)
      listeners.set(channel, list)
    }),
    off: vi.fn((channel: string, listener: (...args: unknown[]) => void) => {
      const list = listeners.get(channel)
      if (!list) return
      const idx = list.indexOf(listener)
      if (idx !== -1) list.splice(idx, 1)
    }),
    channels: IpcChannels,
  }
  Object.defineProperty(window, 'ipc', {
    configurable: true,
    writable: true,
    value: stub,
  })
  // The boot-loop detector subscribes to the device-log store, which only
  // gets its IPC listener mounted via `start()`. The hook used to mount its
  // own listener; now the store owns it (S-M-2). Start it here so the
  // dispatch() helper still reaches both store + subscriber.
  useDeviceLogStore.getState().start()
})

let container: HTMLDivElement | null = null
let root: Root | null = null

afterEach(() => {
  if (root !== null) {
    act(() => {
      root?.unmount()
    })
    root = null
  }
  if (container !== null) {
    container.remove()
    container = null
  }
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function Probe(): null {
  useBootLoopDetector()
  return null
}

async function mount(): Promise<void> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(<Probe />)
    await Promise.resolve()
  })
}

function dispatch(channel: string, payload: unknown): void {
  const list = listeners.get(channel) ?? []
  for (const listener of list.slice()) {
    listener(payload)
  }
}

function bootBanner(version = '0.8.0'): { level: string; tag: string; message: string } {
  return { level: 'I', tag: 'BOOT', message: `CANShift v${version} starting` }
}

describe('useBootLoopDetector (#498)', () => {
  it('flags looping after threshold boot markers within the window', async () => {
    connectDevice()
    await mount()

    act(() => {
      dispatch(IpcChannels.USB_DEVICE_LOG, bootBanner())
      dispatch(IpcChannels.USB_DEVICE_LOG, bootBanner())
      dispatch(IpcChannels.USB_DEVICE_LOG, bootBanner())
    })

    expect(useBootLoopStore.getState().looping).toBe(true)
    expect(useBootLoopStore.getState().lastVersion).toBe('0.8.0')
  })

  it('does NOT flag looping on a single boot marker', async () => {
    connectDevice()
    await mount()

    act(() => {
      dispatch(IpcChannels.USB_DEVICE_LOG, bootBanner())
    })

    expect(useBootLoopStore.getState().looping).toBe(false)
  })

  it('clears looping on the [BOOT] Ready sentinel', async () => {
    connectDevice()
    await mount()

    act(() => {
      dispatch(IpcChannels.USB_DEVICE_LOG, bootBanner())
      dispatch(IpcChannels.USB_DEVICE_LOG, bootBanner())
      dispatch(IpcChannels.USB_DEVICE_LOG, bootBanner())
    })
    expect(useBootLoopStore.getState().looping).toBe(true)

    act(() => {
      dispatch(IpcChannels.USB_DEVICE_LOG, { level: 'I', tag: 'BOOT', message: 'Ready' })
    })

    expect(useBootLoopStore.getState().looping).toBe(false)
    expect(useBootLoopStore.getState().bootMarkers).toEqual([])
  })

  it('clears looping after QUIET_RESET_MS without further boot markers', async () => {
    vi.useFakeTimers()
    connectDevice()
    await mount()

    act(() => {
      dispatch(IpcChannels.USB_DEVICE_LOG, bootBanner())
      dispatch(IpcChannels.USB_DEVICE_LOG, bootBanner())
      dispatch(IpcChannels.USB_DEVICE_LOG, bootBanner())
    })
    expect(useBootLoopStore.getState().looping).toBe(true)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(QUIET_RESET_MS + 100)
    })

    expect(useBootLoopStore.getState().looping).toBe(false)
    expect(useBootLoopStore.getState().bootMarkers).toEqual([])
  })

  it('captures pre-boot context lines, excludes lines after the marker, caps at CONTEXT_LINES', async () => {
    connectDevice()
    await mount()

    // Push more than CONTEXT_LINES lines BEFORE the first boot marker.
    act(() => {
      for (let i = 0; i < CONTEXT_LINES + 5; i++) {
        dispatch(IpcChannels.USB_DEVICE_LOG, {
          level: 'I',
          tag: 'CTX',
          message: `pre ${String(i)}`,
        })
      }
    })

    act(() => {
      dispatch(IpcChannels.USB_DEVICE_LOG, bootBanner())
    })

    // Push lines AFTER the marker — they must NOT appear in the snapshot.
    act(() => {
      dispatch(IpcChannels.USB_DEVICE_LOG, { level: 'I', tag: 'POST', message: 'post 0' })
      dispatch(IpcChannels.USB_DEVICE_LOG, { level: 'I', tag: 'POST', message: 'post 1' })
    })

    const ctx = useBootLoopStore.getState().lastBootContext
    expect(ctx).toHaveLength(CONTEXT_LINES)
    // Most recent pre-marker line is the last entry of the snapshot.
    expect(ctx.at(-1)?.message).toBe(`pre ${String(CONTEXT_LINES + 5 - 1)}`)
    // No post-marker line leaked in.
    expect(ctx.some((l) => l.tag === 'POST')).toBe(false)
  })

  it('shares a single USB_DEVICE_LOG listener with the rest of the app', async () => {
    // S-M-2 (#1015) moved the USB_DEVICE_LOG subscription into
    // `useDeviceLogStore`. The hook subscribes to the store, not to IPC, so
    // mount/unmount no longer toggles the IPC listener — the store owns it.
    connectDevice()
    await mount()
    expect(listeners.get(IpcChannels.USB_DEVICE_LOG)?.length ?? 0).toBe(1)

    act(() => {
      root?.unmount()
    })
    root = null

    expect(listeners.get(IpcChannels.USB_DEVICE_LOG)?.length ?? 0).toBe(1)
  })

  it('resets store + listener when the device disconnects', async () => {
    connectDevice()
    await mount()

    act(() => {
      dispatch(IpcChannels.USB_DEVICE_LOG, bootBanner())
      dispatch(IpcChannels.USB_DEVICE_LOG, bootBanner())
      dispatch(IpcChannels.USB_DEVICE_LOG, bootBanner())
    })
    expect(useBootLoopStore.getState().looping).toBe(true)
    expect(listeners.get(IpcChannels.USB_DEVICE_LOG)?.length ?? 0).toBe(1)

    await act(async () => {
      disconnectDevice()
      await Promise.resolve()
    })

    expect(useBootLoopStore.getState().looping).toBe(false)
    expect(useBootLoopStore.getState().bootMarkers).toEqual([])
    // The store owns the IPC listener (S-M-2) — it stays mounted even when
    // the hook's effect re-runs on disconnect; only the hook's per-entry
    // subscription cycles.
    expect(listeners.get(IpcChannels.USB_DEVICE_LOG)?.length ?? 0).toBe(1)
  })
})

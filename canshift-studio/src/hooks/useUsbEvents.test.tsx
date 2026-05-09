// useUsbEvents.test.tsx — Regression coverage for #484.
//
// Pre-fix, `useUsbConnection` registered the `USB_DEVICE_LOG` listener
// internally, so every concurrently-mounted ConnectModal pushed each device
// log line into `useLogStore` once per active hook instance. The fix moves
// the unsolicited listeners into a single App-level hook (`useUsbEvents`)
// that mounts once. This test locks the contract: a single device-log
// dispatch produces exactly one entry in the log store per hook mount.
//
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useLogStore } from '../stores/log.store'
import { IpcChannels } from '../../main/ipc/ipc-channels'
import { useUsbEvents } from './useUsbEvents'

interface IpcStub {
  invoke: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  channels: Record<string, string>
}

const listeners = new Map<string, ((...args: unknown[]) => void)[]>()

beforeEach(() => {
  listeners.clear()
  useLogStore.setState({ entries: [], verbose: false })
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
  vi.restoreAllMocks()
})

function Probe(): null {
  useUsbEvents()
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
  // Defensive copy — handlers may unsubscribe themselves.
  for (const listener of list.slice()) {
    listener(payload)
  }
}

describe('useUsbEvents — single device-log subscription (#484)', () => {
  it('appends exactly one log entry per USB_DEVICE_LOG event', async () => {
    await mount()

    dispatch(IpcChannels.USB_DEVICE_LOG, {
      level: 'I',
      tag: 'BOOT',
      message: 'CANShift v0.8.0 starting',
    })
    dispatch(IpcChannels.USB_DEVICE_LOG, {
      level: 'I',
      tag: 'HEAP',
      message: 'entry: free=166860 largest=110580',
    })

    const entries = useLogStore.getState().entries
    expect(entries).toHaveLength(2)
    expect(entries[0]?.message).toBe('[device][BOOT] CANShift v0.8.0 starting')
    expect(entries[1]?.message).toBe('[device][HEAP] entry: free=166860 largest=110580')
  })

  it('removes its USB_DEVICE_LOG listener on unmount', async () => {
    await mount()
    expect(listeners.get(IpcChannels.USB_DEVICE_LOG)?.length ?? 0).toBe(1)
    act(() => {
      root?.unmount()
    })
    root = null
    expect(listeners.get(IpcChannels.USB_DEVICE_LOG)?.length ?? 0).toBe(0)
  })

  it('drops malformed device-log payloads silently', async () => {
    await mount()

    dispatch(IpcChannels.USB_DEVICE_LOG, null)
    dispatch(IpcChannels.USB_DEVICE_LOG, { level: 'I' /* missing tag/message */ })
    dispatch(IpcChannels.USB_DEVICE_LOG, 'not-an-object')

    expect(useLogStore.getState().entries).toHaveLength(0)
  })
})

// useCliLogBridge.test.tsx — Regression coverage for the bridge echo loop
// that produced duplicate device log lines when a detached CLI window was
// open (#484).
//
// Pre-fix, the outbound subscriber re-broadcast every store entry — including
// entries injected via `pushFromBridge`. Round-tripping through the bus then
// landed the same log back in the originating window's store with a fresh
// id, doubling every line. The fix marks bridged entries with `bridged: true`
// and skips them in the outbound path.
//
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useCliLogBridge } from './useCliLogBridge'
import { useLogStore } from '../stores/log.store'
import { IpcChannels } from '../../main/ipc/ipc-channels'

interface IpcStub {
  invoke: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  channels: Record<string, string>
}

const listeners = new Map<string, ((...args: unknown[]) => void)[]>()
let sendSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  listeners.clear()
  useLogStore.setState({ entries: [], verbose: false })

  sendSpy = vi.fn()
  const stub: IpcStub = {
    invoke: vi.fn(() => Promise.resolve({ state: { kind: 'inApp' }, backlog: [] })),
    send: sendSpy,
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
  useCliLogBridge()
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
  // Wait one more microtask flush so the seed promise resolves.
  await act(async () => {
    await Promise.resolve()
  })
}

describe('useCliLogBridge — outbound forwarding (#484)', () => {
  it('forwards locally-pushed entries via CLI_LOG_PUSH', async () => {
    await mount()

    act(() => {
      useLogStore.getState().push('info', 'local entry')
    })

    expect(sendSpy).toHaveBeenCalledWith(
      IpcChannels.CLI_LOG_PUSH,
      expect.objectContaining({ message: 'local entry', level: 'info' })
    )
  })

  it('does NOT re-broadcast bridged entries — prevents echo loop', async () => {
    await mount()
    sendSpy.mockClear()

    // Simulate a CLI_LOG_BROADCAST arrival from another renderer.
    const onBroadcast = listeners.get(IpcChannels.CLI_LOG_BROADCAST)?.[0]
    expect(onBroadcast).toBeDefined()

    act(() => {
      onBroadcast?.({
        id: 42,
        level: 'info',
        message: '[device][BOOT] CANShift v0.8.0 starting',
        timestampMs: Date.now(),
      })
    })

    // The bridged entry MUST land in the local store (so xterm renders it)…
    expect(useLogStore.getState().entries).toHaveLength(1)
    expect(useLogStore.getState().entries[0]?.bridged).toBe(true)

    // …but MUST NOT be forwarded back through the bridge.
    const pushCalls = sendSpy.mock.calls.filter((c) => c[0] === IpcChannels.CLI_LOG_PUSH)
    expect(pushCalls).toHaveLength(0)
  })
})

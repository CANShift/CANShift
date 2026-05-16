// useCliLogBridge.test.tsx — Regression coverage for the bridge echo loop
// (#484), the seed-echo duplicate (#575) and the cancelled-seed dead-on-
// arrival detached window (#574).
//
// Pre-fix scenarios:
//   • Echo loop (#484): the outbound subscriber re-broadcast every store
//     entry — including entries injected via `pushFromBridge`. Round-tripping
//     them through the bus landed the same log back in the originating
//     window's store with a fresh id, doubling every line. The fix marks
//     bridged entries with `bridged: true` and skips them in the outbound
//     path.
//   • Seed echo (#575): the seed `CLI_GET_STATE` returned every entry the
//     window had already forwarded to main, then `pushFromBridge` re-inserted
//     each one as a fresh bridged entry. `[main]`/`[device]` lines arrived
//     locally first, were forwarded, then came back through the seed —
//     producing exactly the doubled lines the user reported. The fix tracks
//     forwarded ids and skips them when the seed replays.
//   • Cancelled seed (#574): `seedDoneRef` was set synchronously before the
//     invoke resolved, so a StrictMode mount → cleanup → re-mount cycle
//     would cancel the in-flight seed (via the `cancelled` flag) without
//     ever applying it AND prevent the re-mount from retrying. The fix marks
//     completion only after a successful apply.
//
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useCliLogBridge } from './useCliLogBridge'
import { useLogStore } from '../stores/log.store'
import { IpcChannels } from '../../shared/ipc-channels'

interface IpcStub {
  invoke: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  channels: Record<string, string>
}

const listeners = new Map<string, ((...args: unknown[]) => void)[]>()
let sendSpy: ReturnType<typeof vi.fn>
let invokeSpy: ReturnType<typeof vi.fn>

function installIpcStub(
  invokeImpl: (...args: unknown[]) => Promise<unknown> = () =>
    Promise.resolve({ state: { kind: 'inApp' }, backlog: [] })
): void {
  listeners.clear()
  sendSpy = vi.fn()
  invokeSpy = vi.fn(invokeImpl)
  const stub: IpcStub = {
    invoke: invokeSpy,
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
}

beforeEach(() => {
  useLogStore.setState({ entries: [], verbose: false })
  installIpcStub()
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

    // Simulate a CLI_LOG_BROADCAST_BATCH arrival from another renderer.
    const onBroadcast = listeners.get(IpcChannels.CLI_LOG_BROADCAST_BATCH)?.[0]
    expect(onBroadcast).toBeDefined()

    act(() => {
      onBroadcast?.([
        {
          id: 42,
          level: 'info',
          message: '[device][BOOT] CANShift v0.8.0 starting',
          timestampMs: Date.now(),
        },
      ])
    })

    // The bridged entry MUST land in the local store (so xterm renders it)…
    expect(useLogStore.getState().entries).toHaveLength(1)
    expect(useLogStore.getState().entries[0]?.bridged).toBe(true)

    // …but MUST NOT be forwarded back through the bridge.
    const pushCalls = sendSpy.mock.calls.filter((c) => c[0] === IpcChannels.CLI_LOG_PUSH)
    expect(pushCalls).toHaveLength(0)
  })
})

describe('useCliLogBridge — seed loop suppression (#575)', () => {
  it('does NOT re-inject locally-pushed entries when they come back in the seed backlog', async () => {
    // Reproduce the user's scenario: the renderer pushes a `[main]` line
    // locally (e.g. APP_LOG → useUsbEvents) BEFORE the seed roundtrip
    // resolves. The seed result includes that entry because the outbound
    // subscriber already forwarded it to main. Pre-fix the seed re-injected
    // it via `pushFromBridge`, doubling the entry. Post-fix the bridge
    // remembers which ids it forwarded and skips them on the way back.

    // Set up the IPC stub so we control when the seed resolves.
    let resolveSeed: (value: unknown) => void = () => undefined
    const seedPromise = new Promise<unknown>((resolve) => {
      resolveSeed = resolve
    })
    installIpcStub(() => seedPromise)
    useLogStore.setState({ entries: [], verbose: false })

    await mount()

    // Push a local entry BEFORE the seed resolves — same shape as a
    // `[main]` log produced by useUsbEvents.handleAppLog.
    act(() => {
      useLogStore.getState().push('info', '[main] Main process build')
    })

    // Confirm it was forwarded.
    const pushed = sendSpy.mock.calls.find((c) => c[0] === IpcChannels.CLI_LOG_PUSH)
    expect(pushed).toBeDefined()
    const payload = pushed?.[1] as { id: number; message: string }
    expect(payload.message).toBe('[main] Main process build')

    // Now resolve the seed with the very same entry — the bus would have
    // captured the forwarded line and return it in the backlog.
    await act(async () => {
      resolveSeed({
        state: { kind: 'inApp' },
        backlog: [
          {
            id: payload.id,
            level: 'info',
            message: '[main] Main process build',
            timestampMs: Date.now(),
          },
        ],
      })
      await Promise.resolve()
      await Promise.resolve()
    })

    // The store MUST still hold exactly one entry — the seed must NOT
    // inject a duplicate copy of an entry this window already produced.
    const entries = useLogStore.getState().entries
    expect(entries).toHaveLength(1)
    expect(entries[0]?.message).toBe('[main] Main process build')
    expect(entries[0]?.bridged).toBeUndefined()
  })

  it('still applies seed entries that originated in OTHER windows', async () => {
    // The detached window's case: its store is empty, the backlog comes
    // entirely from the main window. None of the ids match the detached
    // window's `forwardedIdsRef`, so all entries land via pushFromBridge.
    let resolveSeed: (value: unknown) => void = () => undefined
    const seedPromise = new Promise<unknown>((resolve) => {
      resolveSeed = resolve
    })
    installIpcStub(() => seedPromise)
    useLogStore.setState({ entries: [], verbose: false })

    await mount()

    await act(async () => {
      resolveSeed({
        state: { kind: 'inApp' },
        backlog: [
          { id: 1, level: 'info', message: 'from main', timestampMs: 100 },
          { id: 2, level: 'warn', message: 'also from main', timestampMs: 200 },
        ],
      })
      await Promise.resolve()
      await Promise.resolve()
    })

    const entries = useLogStore.getState().entries
    expect(entries).toHaveLength(2)
    expect(entries[0]?.message).toBe('from main')
    expect(entries[0]?.bridged).toBe(true)
    expect(entries[1]?.message).toBe('also from main')
    expect(entries[1]?.bridged).toBe(true)
  })
})

describe('useCliLogBridge — seed retry after StrictMode-style cancellation (#574)', () => {
  it('does NOT mark seed complete when the invoke is cancelled before it resolves', async () => {
    // Pre-fix `seedDoneRef.current` was set synchronously when the invoke
    // started, so a mount → cleanup → re-mount cycle (StrictMode dev or any
    // fast unmount) would cancel the in-flight seed AND lock out future
    // retries. The detached window then opened empty.
    let resolveSeed: (value: unknown) => void = () => undefined
    const seedPromise = new Promise<unknown>((resolve) => {
      resolveSeed = resolve
    })
    installIpcStub(() => seedPromise)
    useLogStore.setState({ entries: [], verbose: false })

    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    // Mount → immediate unmount (simulating React 18 StrictMode dev) so the
    // first effect's `cancelled` flag flips before the seed resolves.
    await act(async () => {
      root?.render(<Probe />)
      await Promise.resolve()
    })

    act(() => {
      root?.unmount()
    })

    // Now resolve the original invoke with a backlog. The cancelled handler
    // MUST drop it without marking seed complete — otherwise a fresh mount
    // would refuse to retry.
    await act(async () => {
      resolveSeed({
        state: { kind: 'inApp' },
        backlog: [{ id: 1, level: 'info', message: 'lost backlog', timestampMs: 100 }],
      })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(useLogStore.getState().entries).toHaveLength(0)

    // Re-mount on a fresh root — this simulates StrictMode's second mount or
    // a re-detach. The bridge MUST issue a fresh invoke (i.e. seed retry).
    invokeSpy.mockClear()
    let resolveSecondSeed: (value: unknown) => void = () => undefined
    const secondSeed = new Promise<unknown>((resolve) => {
      resolveSecondSeed = resolve
    })
    invokeSpy.mockImplementationOnce(() => secondSeed)

    root = createRoot(container)
    await act(async () => {
      root?.render(<Probe />)
      await Promise.resolve()
    })

    expect(invokeSpy).toHaveBeenCalledWith(IpcChannels.CLI_GET_STATE)

    await act(async () => {
      resolveSecondSeed({
        state: { kind: 'inApp' },
        backlog: [{ id: 7, level: 'info', message: 'arrived this time', timestampMs: 300 }],
      })
      await Promise.resolve()
      await Promise.resolve()
    })

    const entries = useLogStore.getState().entries
    expect(entries).toHaveLength(1)
    expect(entries[0]?.message).toBe('arrived this time')
    expect(entries[0]?.bridged).toBe(true)
  })
})

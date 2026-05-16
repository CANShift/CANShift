// useCliDetach.test.ts — coverage for the renderer-side detach state hook
// (issue #433). The hook subscribes to `CLI_STATE_CHANGED` and seeds itself
// from `CLI_GET_STATE`; we drive both via a stubbed `window.ipc` bridge.
//
// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useCliDetach } from './useCliDetach'
import { IpcChannels } from '../../shared/ipc-channels'

const ipcInvoke = vi.fn<(channel: string, ...args: unknown[]) => Promise<unknown>>()
const ipcSend = vi.fn<(channel: string, ...args: unknown[]) => void>()
const ipcOn = vi.fn<(channel: string, listener: (...args: unknown[]) => void) => void>()
const ipcOff = vi.fn<(channel: string, listener: (...args: unknown[]) => void) => void>()

let stateChangedListener: ((...args: unknown[]) => void) | null = null

beforeEach(() => {
  ipcInvoke.mockReset()
  ipcSend.mockReset()
  ipcOn.mockReset()
  ipcOff.mockReset()
  stateChangedListener = null
  ipcOn.mockImplementation((channel, listener) => {
    if (channel === IpcChannels.CLI_STATE_CHANGED) {
      stateChangedListener = listener
    }
  })
  Object.defineProperty(window, 'ipc', {
    configurable: true,
    writable: true,
    value: {
      invoke: ipcInvoke,
      send: ipcSend,
      on: ipcOn,
      off: ipcOff,
      channels: IpcChannels,
    },
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
})

interface ProbeResult {
  state: ReturnType<typeof useCliDetach>['state']
  detach: ReturnType<typeof useCliDetach>['detach']
  reattach: ReturnType<typeof useCliDetach>['reattach']
}

function Probe({ onApi }: { onApi: (api: ProbeResult) => void }): null {
  const api = useCliDetach()
  useEffect(() => {
    onApi(api)
  })
  return null
}

async function mountProbe(): Promise<{ get: () => ProbeResult }> {
  let latest: ProbeResult = {
    state: { kind: 'inApp' },
    detach: () => Promise.resolve(),
    reattach: () => Promise.resolve(),
  }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(
      <Probe
        onApi={(api): void => {
          latest = api
        }}
      />
    )
    await Promise.resolve()
  })
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
  return { get: (): ProbeResult => latest }
}

describe('useCliDetach', () => {
  it('seeds initial state from CLI_GET_STATE', async () => {
    ipcInvoke.mockResolvedValueOnce({ state: { kind: 'detached', windowId: 7 } })
    const probe = await mountProbe()
    expect(probe.get().state).toEqual({ kind: 'detached', windowId: 7 })
    expect(ipcInvoke).toHaveBeenCalledWith(IpcChannels.CLI_GET_STATE)
  })

  it('flips state when CLI_STATE_CHANGED is broadcast', async () => {
    ipcInvoke.mockResolvedValueOnce({ state: { kind: 'inApp' } })
    const probe = await mountProbe()
    expect(probe.get().state).toEqual({ kind: 'inApp' })

    expect(stateChangedListener).not.toBeNull()
    await act(async () => {
      stateChangedListener?.({ state: { kind: 'detached', windowId: 11 } })
      await Promise.resolve()
    })
    expect(probe.get().state).toEqual({ kind: 'detached', windowId: 11 })

    await act(async () => {
      stateChangedListener?.({ state: { kind: 'inApp' } })
      await Promise.resolve()
    })
    expect(probe.get().state).toEqual({ kind: 'inApp' })
  })

  it('detach() and reattach() route through window.ipc.invoke', async () => {
    ipcInvoke.mockResolvedValue({ state: { kind: 'inApp' } })
    const probe = await mountProbe()
    ipcInvoke.mockClear()
    ipcInvoke.mockResolvedValueOnce({ windowId: 99 })

    await probe.get().detach()
    expect(ipcInvoke).toHaveBeenCalledWith(IpcChannels.CLI_DETACH)

    ipcInvoke.mockResolvedValueOnce({ success: true })
    await probe.get().reattach()
    expect(ipcInvoke).toHaveBeenCalledWith(IpcChannels.CLI_REATTACH)
  })
})

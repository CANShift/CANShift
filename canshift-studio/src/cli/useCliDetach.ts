// useCliDetach.ts — Renderer-side state for the CLI detach flow (issue #433).
//
// Subscribes to `CLI_STATE_CHANGED` and seeds initial state from
// `CLI_GET_STATE` so the in-app slot can render either `<CliTerminal />` or
// the `<CliReattachStub />` placeholder. The hook also exposes imperative
// `detach()` / `reattach()` helpers so consumers don't need to reach into the
// IPC bridge.

import { useCallback, useEffect, useState } from 'react'
import { IpcChannels } from '../../shared/ipc-channels'
import type { CliPanelState, CliStateChangedEvent } from '../../shared/cli-detach.types'

const INITIAL_STATE: CliPanelState = { kind: 'inApp' }

export interface CliDetachApi {
  state: CliPanelState
  detach: () => Promise<void>
  reattach: () => Promise<void>
}

interface CliGetStateResponse {
  state: CliPanelState
}

function isCliStateChangedEvent(value: unknown): value is CliStateChangedEvent {
  if (typeof value !== 'object' || value === null) return false
  const v = value as { state?: unknown }
  if (typeof v.state !== 'object' || v.state === null) return false
  const s = v.state as { kind?: unknown }
  return s.kind === 'inApp' || s.kind === 'detached'
}

export function useCliDetach(): CliDetachApi {
  const [state, setState] = useState<CliPanelState>(INITIAL_STATE)

  useEffect(() => {
    let cancelled = false
    void window.ipc
      .invoke(IpcChannels.CLI_GET_STATE)
      .then((value) => {
        if (cancelled) return
        const resp = value as CliGetStateResponse
        setState(resp.state)
      })
      .catch(() => {
        // Best-effort — leave the default in-app state.
      })

    const listener = (...args: unknown[]): void => {
      const payload = args[0]
      if (isCliStateChangedEvent(payload)) {
        setState(payload.state)
      }
    }
    window.ipc.on(IpcChannels.CLI_STATE_CHANGED, listener)
    return () => {
      cancelled = true
      window.ipc.off(IpcChannels.CLI_STATE_CHANGED, listener)
    }
  }, [])

  const detach = useCallback(async (): Promise<void> => {
    await window.ipc.invoke(IpcChannels.CLI_DETACH)
  }, [])

  const reattach = useCallback(async (): Promise<void> => {
    await window.ipc.invoke(IpcChannels.CLI_REATTACH)
  }, [])

  return { state, detach, reattach }
}

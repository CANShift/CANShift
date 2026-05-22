// useCliDetach.ts — Renderer-side state for the CLI detach flow (issue #433).
//
// Reads from `useCliStateStore` (audit S-M-8, umbrella #1015) — the store
// owns the single `CLI_GET_STATE` round-trip + `CLI_STATE_CHANGED`
// subscription so additional call sites can mount this hook without
// re-IPC'ing. The hook itself is a thin selector + imperative bridge over
// `CLI_DETACH` / `CLI_REATTACH`.

import { useCallback, useEffect } from 'react'
import { IpcChannels } from '../../shared/ipc-channels'
import type { CliPanelState } from '../../shared/cli-detach.types'
import { useCliStateStore } from '../stores/cliState.store'

export interface CliDetachApi {
  state: CliPanelState
  detach: () => Promise<void>
  reattach: () => Promise<void>
}

export function useCliDetach(): CliDetachApi {
  const state = useCliStateStore((s) => s.state)
  const ensureLoaded = useCliStateStore((s) => s.ensureLoaded)

  useEffect(() => {
    // Idempotent — subsequent mounts hit the cache and skip the IPC.
    void ensureLoaded()
  }, [ensureLoaded])

  const detach = useCallback(async (): Promise<void> => {
    await window.ipc.invoke(IpcChannels.CLI_DETACH)
  }, [])

  const reattach = useCallback(async (): Promise<void> => {
    await window.ipc.invoke(IpcChannels.CLI_REATTACH)
  }, [])

  return { state, detach, reattach }
}

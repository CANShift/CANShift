// cliState.store.ts — Cached CLI detach panel state (audit S-M-8, umbrella #1015).
//
// Pre-refactor, `useCliDetach` IPC'd `CLI_GET_STATE` on every mount and held
// the result in component state. Mounting the hook a second time (e.g. when
// a future surface wants to render a "detach CLI" button) would re-issue the
// IPC even though the main-process state hadn't changed.
//
// This store seeds itself ONCE on first read, then listens to
// `CLI_STATE_CHANGED` for live updates. The hook becomes a thin selector
// over `state`; subsequent mounts read the cache instead of IPC'ing.
//
// Mirrors the funnel pattern from `deviceLog.store.ts` (S-M-2): one IPC
// listener, many consumers.

import { create } from 'zustand'
import { IpcChannels } from '../../shared/ipc-channels'
import type { CliPanelState, CliStateChangedEvent } from '../../shared/cli-detach.types'

const INITIAL_STATE: CliPanelState = { kind: 'inApp' }

interface CliGetStateResponse {
  state: CliPanelState
}

interface CliStateStoreState {
  /** Latest known CLI panel state. Defaults to `inApp` until seeded. */
  state: CliPanelState
  /** True once `CLI_GET_STATE` has resolved (success or failure). */
  seeded: boolean
  /**
   * Idempotent: kick off the initial fetch + subscribe to live updates. Safe
   * to call from many components — only the first call IPCs.
   */
  ensureLoaded: () => Promise<void>
  /** Tear down the live subscription. Tests + future shutdown paths use this. */
  stop: () => void
}

function isCliStateChangedEvent(value: unknown): value is CliStateChangedEvent {
  if (typeof value !== 'object' || value === null) return false
  const v = value as { state?: unknown }
  if (typeof v.state !== 'object' || v.state === null) return false
  const s = v.state as { kind?: unknown }
  return s.kind === 'inApp' || s.kind === 'detached'
}

// Module-scoped lifecycle handles so identity stays stable across React mounts.
let stateChangedListener: ((...args: unknown[]) => void) | null = null
let loadPromise: Promise<void> | null = null

export const useCliStateStore = create<CliStateStoreState>()((set, get) => ({
  state: INITIAL_STATE,
  seeded: false,

  ensureLoaded: async () => {
    if (get().seeded || loadPromise !== null) {
      if (loadPromise !== null) await loadPromise
      return
    }
    // Install the live listener BEFORE the initial fetch so a fast main-side
    // transition between the fetch and the resolved state can't slip past us.
    if (stateChangedListener === null) {
      stateChangedListener = (...args: unknown[]): void => {
        const payload = args[0]
        if (!isCliStateChangedEvent(payload)) return
        set({ state: payload.state })
      }
      window.ipc.on(IpcChannels.CLI_STATE_CHANGED, stateChangedListener)
    }

    loadPromise = (async (): Promise<void> => {
      try {
        const value = (await window.ipc.invoke(IpcChannels.CLI_GET_STATE)) as CliGetStateResponse
        set({ state: value.state, seeded: true })
      } catch {
        // Best-effort — keep the default in-app state and mark seeded so we
        // don't loop on transient IPC failures.
        set({ seeded: true })
      } finally {
        loadPromise = null
      }
    })()
    await loadPromise
  },

  stop: () => {
    if (stateChangedListener !== null) {
      window.ipc.off(IpcChannels.CLI_STATE_CHANGED, stateChangedListener)
      stateChangedListener = null
    }
    loadPromise = null
  },
}))

/**
 * Test seam — clears the module-scoped listener handle, the in-flight fetch
 * promise, and the store state so each test starts cold.
 */
export function _resetCliStateStoreForTest(): void {
  stateChangedListener = null
  loadPromise = null
  useCliStateStore.setState({ state: INITIAL_STATE, seeded: false })
}

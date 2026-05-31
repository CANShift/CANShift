// input-bindings.store.ts — Physical GPIO button bindings.
//
// Mirrors the Electron Studio's `useInputBindingsStore` so the editor surface
// can be ported with no shape changes. Owns the editable draft plus the
// load/save lifecycle — components stay thin and free of useEffect fetching.
//
// Backed by `inputBindingsIpc` from the dash-hosted transport — the IPC layer
// routes CMD_GET_INPUT_BINDINGS / CMD_PUT_INPUT_BINDINGS through the shared
// WsClient singleton. `load()` is idempotent across the session.

import { create } from 'zustand'
import type { InputBinding } from '@tmbk/canshift-core'
import { inputBindingsIpc } from '../transport'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface InputBindingsState {
  /** Editable draft of the bindings list. */
  bindings: InputBinding[]
  /** True once the initial IPC `read()` has resolved (success or failure). */
  loaded: boolean
  saveStatus: SaveStatus
  saveError: string | null

  /** Idempotent — fetches once per session, no-op afterwards. */
  load: () => Promise<void>
  /** Replace the in-memory draft (no IPC). */
  setBindings: (next: InputBinding[]) => void
  /** Patch a single binding by index. */
  updateBinding: (idx: number, patch: Partial<InputBinding>) => void
  /** Append a new binding to the draft. */
  addBinding: (binding: InputBinding) => void
  /** Remove a binding by index. */
  removeBinding: (idx: number) => void
  /** Persist the draft via IPC and update `saveStatus`. */
  save: () => Promise<void>
  /** Reset the transient `saveStatus` (used after the "Saved" badge fades). */
  clearSaveStatus: () => void
}

export const useInputBindingsStore = create<InputBindingsState>()((set, get) => ({
  bindings: [],
  loaded: false,
  saveStatus: 'idle',
  saveError: null,

  load: async () => {
    // Already loaded — nothing to do. The on-device bindings don't change
    // behind our back during a session.
    if (get().loaded) return
    try {
      const result = await inputBindingsIpc.read()
      if (result.success && result.config) {
        set({ bindings: result.config.inputBindings, loaded: true })
        return
      }
      set({ loaded: true })
    } catch {
      // Best-effort — surface an empty draft so the user can still build
      // bindings from scratch even if the read failed.
      set({ loaded: true })
    }
  },

  setBindings: (next) => {
    set({ bindings: next })
  },

  updateBinding: (idx, patch) => {
    set((s) => ({
      bindings: s.bindings.map((b, i) => (i === idx ? { ...b, ...patch } : b)),
    }))
  },

  addBinding: (binding) => {
    set((s) => ({ bindings: [...s.bindings, binding] }))
  },

  removeBinding: (idx) => {
    set((s) => ({ bindings: s.bindings.filter((_, i) => i !== idx) }))
  },

  save: async () => {
    set({ saveStatus: 'saving', saveError: null })
    try {
      const result = await inputBindingsIpc.write({ inputBindings: get().bindings })
      if (result.success) {
        set({ saveStatus: 'saved', saveError: null })
        return
      }
      set({ saveStatus: 'error', saveError: result.error ?? 'Save failed' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      set({ saveStatus: 'error', saveError: msg })
    }
  },

  clearSaveStatus: () => {
    set({ saveStatus: 'idle', saveError: null })
  },
}))

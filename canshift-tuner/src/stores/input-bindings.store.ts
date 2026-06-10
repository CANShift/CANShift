import { create } from 'zustand'
import type { InputBinding } from '@tmbk/canshift-core'
import { inputBindingsIpc } from '../transport'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface InputBindingsState {
  bindings: InputBinding[]
  loaded: boolean
  saveStatus: SaveStatus
  saveError: string | null

  load: () => Promise<void>
  setBindings: (next: InputBinding[]) => void
  updateBinding: (idx: number, patch: Partial<InputBinding>) => void
  addBinding: (binding: InputBinding) => void
  removeBinding: (idx: number) => void
  save: () => Promise<void>
  clearSaveStatus: () => void
}

export const useInputBindingsStore = create<InputBindingsState>()((set, get) => ({
  bindings: [],
  loaded: false,
  saveStatus: 'idle',
  saveError: null,

  load: async () => {
    if (get().loaded) return
    try {
      const result = await inputBindingsIpc.read()
      if (result.success && result.config) {
        set({ bindings: result.config.inputBindings, loaded: true })
        return
      }
      set({ loaded: true })
    } catch {
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

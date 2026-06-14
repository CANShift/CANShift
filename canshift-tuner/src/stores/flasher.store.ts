import { create } from 'zustand'

export type FlasherState =
  | { kind: 'idle' }
  | { kind: 'flashing'; written: number; total: number }
  | { kind: 'success' }
  | { kind: 'error'; message: string }

interface FlasherStoreState {
  state: FlasherState
  setState: (next: FlasherState) => void
}

export const useFlasherStore = create<FlasherStoreState>()((set) => ({
  state: { kind: 'idle' },
  setState: (next) => {
    set({ state: next })
  },
}))

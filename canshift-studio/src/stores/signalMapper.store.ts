// signalMapper.store.ts — State for the CAN signal mapping panel.
//
// Holds user-defined SignalDef entries built from the CAN scanner.
// Exported as signals.json via the SIGNAL_EXPORT IPC channel.

import { create } from 'zustand'
import type { SignalDef } from '@tmbk/canshift-core'

interface SignalMapperState {
  signals: SignalDef[]
  addSignal: (signal: SignalDef) => void
  removeSignal: (name: string) => void
  clearSignals: () => void
}

export const useSignalMapperStore = create<SignalMapperState>((set) => ({
  signals: [],

  addSignal: (signal) => {
    set((state) => {
      // Replace if signal with same name already exists
      const filtered = state.signals.filter((s) => s.name !== signal.name)
      return { signals: [...filtered, signal] }
    })
  },

  removeSignal: (name) => {
    set((state) => ({ signals: state.signals.filter((s) => s.name !== name) }))
  },

  clearSignals: () => {
    set({ signals: [] })
  },
}))

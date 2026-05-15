// signals.store.ts — Live signal values from BLE telemetry

import { create } from 'zustand'
import { pushSample } from './telemetry.store'

// Raw telemetry payload from firmware (compact keys)
export type TelemetryPayload = Partial<Record<string, number>>

interface SignalsState {
  values: TelemetryPayload
  lastUpdateMs: number
  isLive: boolean // false if no update received in last 2s

  update: (payload: TelemetryPayload) => void
  markStale: () => void
}

export const useSignalsStore = create<SignalsState>()((set) => ({
  values: {},
  lastUpdateMs: 0,
  isLive: false,

  update: (payload) => {
    // parseTelemetry can return a partial map (a parser drop yields undefined
    // for that key). Strip them before pushing so the ring buffer never holds
    // entries with undefined values — downstream Number.isFinite checks would
    // otherwise mask the source of the gap.
    const defined: Record<string, number> = {}
    for (const [k, v] of Object.entries(payload)) {
      if (typeof v === 'number') defined[k] = v
    }
    pushSample(defined)
    set({ values: payload, lastUpdateMs: Date.now(), isLive: true })
  },

  markStale: () => {
    set({ isLive: false })
  },
}))

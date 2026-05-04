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
    pushSample(payload as Record<string, number>)
    set({ values: payload, lastUpdateMs: Date.now(), isLive: true })
  },

  markStale: () => set({ isLive: false }),
}))

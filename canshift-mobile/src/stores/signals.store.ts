import { create } from 'zustand'
import type { SignalKey } from '../constants/ble'
import { pushSample, type SignalValues } from './telemetry.store'

export type TelemetryPayload = Partial<Record<SignalKey, number>>

interface SignalsState {
  values: TelemetryPayload
  lastUpdateMs: number
  isLive: boolean

  update: (payload: TelemetryPayload) => void
  markStale: () => void
}

export const useSignalsStore = create<SignalsState>()((set) => ({
  values: {},
  lastUpdateMs: 0,
  isLive: false,

  update: (payload) => {
    const defined: SignalValues = {}
    for (const [k, v] of Object.entries(payload)) {
      if (typeof v === 'number') defined[k as SignalKey] = v
    }
    pushSample(defined)
    set((s) => ({ values: { ...s.values, ...payload }, lastUpdateMs: Date.now(), isLive: true }))
  },

  markStale: () => {
    set({ isLive: false })
  },
}))

export const useSignalValue = (key: SignalKey): number | undefined => {
  return useSignalsStore((s) => s.values[key])
}

export const useSignalsIsLive = (): boolean => {
  return useSignalsStore((s) => s.isLive)
}

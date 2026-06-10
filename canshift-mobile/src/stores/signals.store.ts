import { create } from 'zustand'
import { pushSample } from './telemetry.store'

export type TelemetryPayload = Partial<Record<string, number>>

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
    const defined: Record<string, number> = {}
    for (const [k, v] of Object.entries(payload)) {
      if (typeof v === 'number') defined[k] = v
    }
    pushSample(defined)
    set((s) => ({ values: { ...s.values, ...payload }, lastUpdateMs: Date.now(), isLive: true }))
  },

  markStale: () => {
    set({ isLive: false })
  },
}))

export const useSignalValue = (key: string): number | undefined => {
  return useSignalsStore((s) => s.values[key])
}

export const useSignalsIsLive = (): boolean => {
  return useSignalsStore((s) => s.isLive)
}

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
    // Merge instead of replace — firmware skips invalid signals in the BLE
    // TELE payload (`ble_server.cpp` filters by `SignalStore::isValid`), so a
    // single-signal dropout would otherwise blank every other live reading
    // for one tick. Last-known values are retained across the gap; staleness
    // is signalled separately by `isLive` (#1017 M-LO-3).
    set((s) => ({ values: { ...s.values, ...payload }, lastUpdateMs: Date.now(), isLive: true }))
  },

  markStale: () => {
    set({ isLive: false })
  },
}))

/**
 * Per-key selector — subscribers re-render only when *their* signal changes.
 * Zustand's default identity check on a primitive return skips re-renders
 * when the numeric value is unchanged across the 10 Hz tick, even though the
 * containing `values` object is replaced every update (#687).
 */
export function useSignalValue(key: string): number | undefined {
  return useSignalsStore((s) => s.values[key])
}

/** Reactive `isLive` flag — flips on/off rarely, safe to subscribe broadly. */
export function useSignalsIsLive(): boolean {
  return useSignalsStore((s) => s.isLive)
}

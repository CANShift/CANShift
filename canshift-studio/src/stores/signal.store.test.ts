// signal.store.test.ts — Locks the bundled DEFAULT_SIGNALS list and the
// `setSignals` reducer used to swap in a user-edited mapping.

import { beforeEach, describe, expect, it } from 'vitest'
import type { SignalDef } from '@tmbk/canshift-core'
import { useSignalStore } from './signal.store'

const INITIAL_SIGNAL_NAMES = [
  'rpm',
  'throttle_pos',
  'map_kpa',
  'iat_c',
  'speed_kph',
  'lambda_1',
  'gear',
  'fuel_press_bar',
  'coolant_temp_c',
  'oil_temp_c',
  'oil_press_bar',
  'battery_volts',
  'flag_mil',
  'flag_launch_ctrl',
  'map_number',
  'afr_1',
  'boost_bar',
] as const

describe('signal.store', () => {
  // Snapshot the baked-in signals so each test starts from the same point even
  // after a previous test has mutated the singleton store.
  const initialSignals = useSignalStore.getState().signals

  beforeEach(() => {
    useSignalStore.setState({ signals: initialSignals })
  })

  it('exposes the bundled MaxxECU signal map on init', () => {
    const names = useSignalStore.getState().signals.map((s) => s.name)
    expect(names).toEqual(INITIAL_SIGNAL_NAMES)
  })

  it('every default entry has a non-empty name and a valid hex CAN frame id', () => {
    for (const sig of useSignalStore.getState().signals) {
      expect(sig.name.length).toBeGreaterThan(0)
      expect(sig.canFrameId).toMatch(/^0x[0-9A-Fa-f]+$/)
      expect(sig.byteLength).toBeGreaterThan(0)
      expect(sig.timeoutMs).toBeGreaterThan(0)
      expect(sig.max).toBeGreaterThanOrEqual(sig.min)
    }
  })

  it('setSignals() replaces the list wholesale', () => {
    const replacement: SignalDef[] = [
      {
        name: 'custom',
        canFrameId: '0x500',
        startByte: 0,
        byteLength: 1,
        bigEndian: false,
        signed: false,
        scale: 1,
        offset: 0,
        unit: '',
        min: 0,
        max: 1,
        timeoutMs: 1000,
      },
    ]

    useSignalStore.getState().setSignals(replacement)

    const state = useSignalStore.getState()
    expect(state.signals).toHaveLength(1)
    expect(state.signals[0]?.name).toBe('custom')
  })

  it('setSignals([]) clears the list', () => {
    useSignalStore.getState().setSignals([])
    expect(useSignalStore.getState().signals).toEqual([])
  })
})

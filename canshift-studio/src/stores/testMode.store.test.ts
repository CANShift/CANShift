// testMode.store.test.ts — Behaviour contract for the studio-only signal
// value injection used to verify thresholds without a live ECU.

import { beforeEach, describe, expect, it } from 'vitest'
import type { SignalDef } from '@tmbk/canshift-core'
import { useTestModeStore } from './testMode.store'

function makeSignal(name: string, min: number, max: number): SignalDef {
  return {
    name,
    canFrameId: '0x500',
    startByte: 0,
    byteLength: 1,
    bigEndian: false,
    signed: false,
    scale: 1,
    offset: 0,
    unit: '',
    min,
    max,
    timeoutMs: 1000,
  }
}

describe('testMode.store', () => {
  beforeEach(() => {
    useTestModeStore.setState({ enabled: false, values: {} })
  })

  it('starts disabled with no pinned values', () => {
    const state = useTestModeStore.getState()
    expect(state.enabled).toBe(false)
    expect(state.values).toEqual({})
  })

  it('setEnabled() toggles the flag', () => {
    useTestModeStore.getState().setEnabled(true)
    expect(useTestModeStore.getState().enabled).toBe(true)

    useTestModeStore.getState().setEnabled(false)
    expect(useTestModeStore.getState().enabled).toBe(false)
  })

  it('setValue() pins a per-signal value', () => {
    useTestModeStore.getState().setValue('rpm', 4500)

    expect(useTestModeStore.getState().values).toEqual({ rpm: 4500 })
  })

  it('setValue() updates an existing pinned value without dropping others', () => {
    useTestModeStore.getState().setValue('rpm', 4500)
    useTestModeStore.getState().setValue('iat', 25)

    useTestModeStore.getState().setValue('rpm', 8000)

    expect(useTestModeStore.getState().values).toEqual({ rpm: 8000, iat: 25 })
  })

  it('syncFromSignals() seeds the midpoint for any signal missing a value', () => {
    useTestModeStore
      .getState()
      .syncFromSignals([makeSignal('rpm', 0, 8000), makeSignal('iat', -40, 215)])

    expect(useTestModeStore.getState().values).toEqual({
      rpm: 4000,
      iat: 87.5,
    })
  })

  it('syncFromSignals() does NOT clobber an already-pinned value', () => {
    useTestModeStore.getState().setValue('rpm', 7000)

    useTestModeStore.getState().syncFromSignals([makeSignal('rpm', 0, 8000)])

    expect(useTestModeStore.getState().values.rpm).toBe(7000)
  })

  it('syncFromSignals() returns 0 for a degenerate range (min >= max)', () => {
    useTestModeStore.getState().syncFromSignals([
      // max === min → range is degenerate → midpoint() falls back to 0
      makeSignal('flag', 5, 5),
    ])

    expect(useTestModeStore.getState().values.flag).toBe(0)
  })

  it('syncFromSignals() returns 0 when min/max are not finite numbers', () => {
    const sig = makeSignal('weird', Number.NaN, Number.POSITIVE_INFINITY)
    useTestModeStore.getState().syncFromSignals([sig])

    expect(useTestModeStore.getState().values.weird).toBe(0)
  })

  it('syncFromSignals() with all signals already pinned returns the same state object', () => {
    useTestModeStore.getState().setValue('rpm', 4000)
    const before = useTestModeStore.getState().values

    useTestModeStore.getState().syncFromSignals([makeSignal('rpm', 0, 8000)])

    // The reducer returns `{}` to short-circuit when nothing changes; verify
    // the values reference is preserved (zustand merge keeps the old slice).
    expect(useTestModeStore.getState().values).toBe(before)
  })

  it('pruneMissing() drops values whose signals no longer exist', () => {
    useTestModeStore.getState().setValue('rpm', 4000)
    useTestModeStore.getState().setValue('legacy_signal', 1)

    useTestModeStore.getState().pruneMissing([makeSignal('rpm', 0, 8000)])

    expect(useTestModeStore.getState().values).toEqual({ rpm: 4000 })
  })

  it('pruneMissing() is a no-op when every value still has a signal', () => {
    useTestModeStore.getState().setValue('rpm', 4000)
    const before = useTestModeStore.getState().values

    useTestModeStore.getState().pruneMissing([makeSignal('rpm', 0, 8000)])

    expect(useTestModeStore.getState().values).toBe(before)
  })

  it('reset() clears the enabled flag and all pinned values', () => {
    useTestModeStore.getState().setEnabled(true)
    useTestModeStore.getState().setValue('rpm', 4000)

    useTestModeStore.getState().reset()

    const state = useTestModeStore.getState()
    expect(state.enabled).toBe(false)
    expect(state.values).toEqual({})
  })
})

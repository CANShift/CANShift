// stores/__tests__/test-mode-store.test.ts — Coverage for the studio-only
// signal injection store used by Test Mode (#1077 follow-up).
//
// Lots of small invariants here that the Test Mode panel depends on:
//   - syncFromSignals only seeds *missing* keys (a pinned value the user
//     dialled in MUST NOT be overwritten on every signal-list refresh)
//   - syncFromSignals picks a sensible midpoint for new signals
//   - pruneMissing drops keys whose signals have been removed
//   - setValue is additive (other keys preserved)
//   - reset clears everything and disables Test Mode

import { describe, it, expect, beforeEach } from 'vitest'
import type { SignalDef } from '@tmbk/canshift-core'
import { useTestModeStore } from '../testMode.store'

function sig(name: string, min: number, max: number): SignalDef {
  return {
    name,
    min,
    max,
    unit: '',
    scale: 1,
    offset: 0,
  } as unknown as SignalDef
}

beforeEach(() => {
  useTestModeStore.getState().reset()
})

describe('testMode.store — value editing', () => {
  it('setValue adds a key without touching existing ones', () => {
    useTestModeStore.getState().setValue('rpm', 1234)
    useTestModeStore.getState().setValue('speed', 88)
    expect(useTestModeStore.getState().values).toEqual({ rpm: 1234, speed: 88 })
  })

  it('setEnabled toggles the flag without clearing values', () => {
    useTestModeStore.getState().setValue('rpm', 1)
    useTestModeStore.getState().setEnabled(true)
    expect(useTestModeStore.getState().enabled).toBe(true)
    expect(useTestModeStore.getState().values).toEqual({ rpm: 1 })
  })

  it('reset() clears enabled + values together', () => {
    useTestModeStore.getState().setValue('rpm', 1)
    useTestModeStore.getState().setEnabled(true)
    useTestModeStore.getState().reset()
    expect(useTestModeStore.getState().enabled).toBe(false)
    expect(useTestModeStore.getState().values).toEqual({})
  })
})

describe('testMode.store — syncFromSignals', () => {
  it('seeds the midpoint of [min, max] for missing signal keys', () => {
    useTestModeStore.getState().syncFromSignals([sig('rpm', 0, 8000), sig('temp', 60, 110)])
    expect(useTestModeStore.getState().values).toEqual({ rpm: 4000, temp: 85 })
  })

  it('does NOT overwrite pinned values when the signal already exists', () => {
    useTestModeStore.getState().setValue('rpm', 7500)
    useTestModeStore.getState().syncFromSignals([sig('rpm', 0, 8000)])
    expect(useTestModeStore.getState().values.rpm).toBe(7500)
  })

  it('falls back to 0 for signals with non-finite or inverted ranges', () => {
    useTestModeStore.getState().syncFromSignals([sig('bad', 100, 50)])
    expect(useTestModeStore.getState().values).toEqual({ bad: 0 })
  })

  it('returns the same state shape (no-op) when every signal is already pinned', () => {
    useTestModeStore.getState().setValue('rpm', 1000)
    const before = useTestModeStore.getState().values
    useTestModeStore.getState().syncFromSignals([sig('rpm', 0, 8000)])
    expect(useTestModeStore.getState().values).toEqual(before)
  })
})

describe('testMode.store — pruneMissing', () => {
  it('drops keys for signals that no longer exist', () => {
    useTestModeStore.getState().setValue('rpm', 1)
    useTestModeStore.getState().setValue('legacy', 2)
    useTestModeStore.getState().pruneMissing([sig('rpm', 0, 100)])
    expect(useTestModeStore.getState().values).toEqual({ rpm: 1 })
  })

  it('is a no-op when every pinned key is present in the signal list', () => {
    useTestModeStore.getState().setValue('rpm', 1)
    const before = useTestModeStore.getState().values
    useTestModeStore.getState().pruneMissing([sig('rpm', 0, 100)])
    // Identity check would be too strict — but the value table should match.
    expect(useTestModeStore.getState().values).toEqual(before)
  })
})

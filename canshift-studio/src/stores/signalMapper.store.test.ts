// signalMapper.store.test.ts — Behaviour contract for the signal mapping
// panel state. Holds user-defined SignalDef entries, dedupes by name on add.

import { beforeEach, describe, expect, it } from 'vitest'
import type { SignalDef } from '@tmbk/canshift-core'
import { useSignalMapperStore } from './signalMapper.store'

function makeSignal(name: string, canFrameId = '0x500'): SignalDef {
  return {
    name,
    canFrameId,
    startByte: 0,
    byteLength: 1,
    bigEndian: false,
    signed: false,
    scale: 1,
    offset: 0,
    unit: '',
    min: 0,
    max: 255,
    timeoutMs: 1000,
  }
}

describe('signalMapper.store', () => {
  beforeEach(() => {
    useSignalMapperStore.setState({ signals: [] })
  })

  it('starts with an empty signal list', () => {
    expect(useSignalMapperStore.getState().signals).toEqual([])
  })

  it('addSignal() appends a new entry', () => {
    const sig = makeSignal('rpm')
    useSignalMapperStore.getState().addSignal(sig)

    expect(useSignalMapperStore.getState().signals).toEqual([sig])
  })

  it('addSignal() replaces an entry with the same name (dedupe by name)', () => {
    const original = makeSignal('rpm', '0x370')
    const replacement = makeSignal('rpm', '0x600')

    useSignalMapperStore.getState().addSignal(original)
    useSignalMapperStore.getState().addSignal(replacement)

    const state = useSignalMapperStore.getState()
    expect(state.signals).toHaveLength(1)
    expect(state.signals[0]?.canFrameId).toBe('0x600')
  })

  it('addSignal() keeps unrelated entries when replacing one (replace, not reset)', () => {
    useSignalMapperStore.getState().addSignal(makeSignal('rpm', '0x370'))
    useSignalMapperStore.getState().addSignal(makeSignal('iat', '0x371'))

    useSignalMapperStore.getState().addSignal(makeSignal('rpm', '0x600'))

    const state = useSignalMapperStore.getState()
    expect(state.signals).toHaveLength(2)
    const names = state.signals.map((s) => s.name).sort()
    expect(names).toEqual(['iat', 'rpm'])
  })

  it('removeSignal() drops the entry with the matching name', () => {
    useSignalMapperStore.getState().addSignal(makeSignal('rpm'))
    useSignalMapperStore.getState().addSignal(makeSignal('iat'))

    useSignalMapperStore.getState().removeSignal('rpm')

    const state = useSignalMapperStore.getState()
    expect(state.signals).toHaveLength(1)
    expect(state.signals[0]?.name).toBe('iat')
  })

  it('removeSignal() with an unknown name is a no-op', () => {
    useSignalMapperStore.getState().addSignal(makeSignal('rpm'))

    useSignalMapperStore.getState().removeSignal('does-not-exist')

    expect(useSignalMapperStore.getState().signals).toHaveLength(1)
  })

  it('clearSignals() empties the list', () => {
    useSignalMapperStore.getState().addSignal(makeSignal('rpm'))
    useSignalMapperStore.getState().addSignal(makeSignal('iat'))

    useSignalMapperStore.getState().clearSignals()

    expect(useSignalMapperStore.getState().signals).toEqual([])
  })
})

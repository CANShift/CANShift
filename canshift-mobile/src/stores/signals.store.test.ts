// signals.store.test.ts — Tests for the live BLE signal values store

import { clearBuffer, getRange, getWriteIndex } from './telemetry.store'
import { useSignalsStore } from './signals.store'

const initialState = useSignalsStore.getState()

describe('useSignalsStore', () => {
  beforeEach(() => {
    useSignalsStore.setState(initialState, true)
    clearBuffer()
  })

  it('exposes a clean initial state', () => {
    const state = useSignalsStore.getState()
    expect(state.values).toEqual({})
    expect(state.lastUpdateMs).toBe(0)
    expect(state.isLive).toBe(false)
  })

  it('update() stores the payload, marks live, and stamps lastUpdateMs', () => {
    const before = Date.now()
    useSignalsStore.getState().update({ r: 1500, tps: 10 })
    const state = useSignalsStore.getState()
    expect(state.values).toEqual({ r: 1500, tps: 10 })
    expect(state.isLive).toBe(true)
    expect(state.lastUpdateMs).toBeGreaterThanOrEqual(before)
  })

  it('update() forwards the sample to the telemetry ring buffer', () => {
    useSignalsStore.getState().update({ r: 2000, tps: 20 })
    const buffer = getRange(0, getWriteIndex())
    expect(buffer).toHaveLength(1)
    expect(buffer[0]?.v).toEqual({ r: 2000, tps: 20 })
  })

  it('update() handles an empty payload without throwing', () => {
    useSignalsStore.getState().update({})
    const state = useSignalsStore.getState()
    expect(state.values).toEqual({})
    expect(state.isLive).toBe(true)
  })

  it('markStale() flips isLive off without clearing the cached values', () => {
    useSignalsStore.getState().update({ r: 1500 })
    useSignalsStore.getState().markStale()
    const state = useSignalsStore.getState()
    expect(state.isLive).toBe(false)
    expect(state.values).toEqual({ r: 1500 })
  })

  it('successive updates replace the cached payload entirely', () => {
    useSignalsStore.getState().update({ r: 1500, tps: 10 })
    useSignalsStore.getState().update({ r: 2000 })
    expect(useSignalsStore.getState().values).toEqual({ r: 2000 })
  })

  it('update() strips undefined entries before pushing to the ring buffer', () => {
    useSignalsStore.getState().update({ r: 2000, tps: undefined, ect: 90 })
    const buffer = getRange(0, getWriteIndex())
    expect(buffer).toHaveLength(1)
    expect(buffer[0]?.v).toEqual({ r: 2000, ect: 90 })
    // Cached store payload retains the partial shape — only the ring buffer
    // is filtered (consumers branch on Number.isFinite already).
    expect(useSignalsStore.getState().values).toEqual({ r: 2000, tps: undefined, ect: 90 })
  })
})

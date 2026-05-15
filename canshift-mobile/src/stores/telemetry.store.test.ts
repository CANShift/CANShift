// telemetry.store.test.ts — Tests for the telemetry ring buffer

import {
  clearBuffer,
  getBuffer,
  getRange,
  getWriteIndex,
  pushSample,
} from './telemetry.store'

const MAX_SAMPLES = 3000

describe('telemetry.store', () => {
  beforeEach(() => {
    clearBuffer()
  })

  it('pushes a sample and exposes it via getBuffer with a copy of values', () => {
    const values = { r: 1500, tps: 10 }
    pushSample(values)
    const buffer = getBuffer()
    expect(buffer).toHaveLength(1)
    expect(buffer[0]?.v).toEqual({ r: 1500, tps: 10 })
    // Mutating the source object after push must not affect the stored sample
    values.r = 9999
    expect(buffer[0]?.v.r).toBe(1500)
  })

  it('caps the buffer at 3000 samples, dropping the oldest first', () => {
    for (let i = 0; i < MAX_SAMPLES + 50; i += 1) {
      pushSample({ r: i })
    }
    const buffer = getBuffer()
    expect(buffer).toHaveLength(MAX_SAMPLES)
    // First retained sample should be at index 50 (50 oldest evicted)
    expect(buffer[0]?.v.r).toBe(50)
    expect(buffer[MAX_SAMPLES - 1]?.v.r).toBe(MAX_SAMPLES + 49)
  })

  it('clearBuffer() empties the buffer', () => {
    pushSample({ r: 1 })
    pushSample({ r: 2 })
    expect(getBuffer()).toHaveLength(2)
    clearBuffer()
    expect(getBuffer()).toHaveLength(0)
  })

  describe('getWriteIndex', () => {
    it('starts at 0 and increments monotonically per push', () => {
      expect(getWriteIndex()).toBe(0)
      pushSample({ r: 1 })
      expect(getWriteIndex()).toBe(1)
      pushSample({ r: 2 })
      pushSample({ r: 3 })
      expect(getWriteIndex()).toBe(3)
    })

    it('does not wrap when the ring buffer wraps', () => {
      for (let i = 0; i < MAX_SAMPLES + 100; i += 1) {
        pushSample({ r: i })
      }
      expect(getWriteIndex()).toBe(MAX_SAMPLES + 100)
    })

    it('resets to 0 on clearBuffer', () => {
      pushSample({ r: 1 })
      pushSample({ r: 2 })
      clearBuffer()
      expect(getWriteIndex()).toBe(0)
    })
  })

  describe('getRange', () => {
    it('returns an empty array for an empty range', () => {
      pushSample({ r: 1 })
      expect(getRange(0, 0)).toEqual([])
      expect(getRange(5, 3)).toEqual([])
    })

    it('returns samples in [from, to) — exclusive upper bound', () => {
      for (let i = 0; i < 5; i += 1) pushSample({ r: i })
      const slice = getRange(1, 4)
      expect(slice).toHaveLength(3)
      expect(slice.map((s) => s.v.r)).toEqual([1, 2, 3])
    })

    it('returns only newly pushed samples since the last observed index', () => {
      pushSample({ r: 1 })
      pushSample({ r: 2 })
      const lastSeen = getWriteIndex()
      pushSample({ r: 3 })
      pushSample({ r: 4 })
      const fresh = getRange(lastSeen, getWriteIndex())
      expect(fresh).toHaveLength(2)
      expect(fresh.map((s) => s.v.r)).toEqual([3, 4])
    })

    it('clamps fromIndex to the oldest retained sample after wrap', () => {
      // Push enough to wrap the ring buffer.
      for (let i = 0; i < MAX_SAMPLES + 100; i += 1) {
        pushSample({ r: i })
      }
      // Asking for samples older than the retained window should clamp.
      const slice = getRange(0, getWriteIndex())
      expect(slice).toHaveLength(MAX_SAMPLES)
      // Oldest retained is monotonic index 100 (100 samples evicted).
      expect(slice[0]?.v.r).toBe(100)
      expect(slice[MAX_SAMPLES - 1]?.v.r).toBe(MAX_SAMPLES + 99)
    })

    it('clamps toIndex to the current writeIndex', () => {
      pushSample({ r: 1 })
      pushSample({ r: 2 })
      const slice = getRange(0, 999)
      expect(slice).toHaveLength(2)
      expect(slice.map((s) => s.v.r)).toEqual([1, 2])
    })

    it('returns chronologically ordered samples after a ring wrap', () => {
      for (let i = 0; i < MAX_SAMPLES + 5; i += 1) {
        pushSample({ r: i })
      }
      // Ask for the last 10 samples — must straddle the head/tail wrap point.
      const writeIdx = getWriteIndex()
      const slice = getRange(writeIdx - 10, writeIdx)
      expect(slice).toHaveLength(10)
      const expected = Array.from({ length: 10 }, (_, i) => writeIdx - 10 + i)
      expect(slice.map((s) => s.v.r)).toEqual(expected)
    })

    it('returns an empty array when called on an empty buffer', () => {
      expect(getRange(0, 5)).toEqual([])
    })
  })
})

// telemetry.store.test.ts — Tests for the telemetry ring buffer

import { clearBuffer, getBuffer, pushSample } from './telemetry.store'

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
})

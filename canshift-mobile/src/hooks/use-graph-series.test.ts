import type { TelemetrySample } from '../stores/telemetry.store'
import { ingestIncremental } from './use-graph-series'

const sample = (t: number, r: number): TelemetrySample => {
  return { t, v: { r } }
}

describe('ingestIncremental', () => {
  it('appends fresh samples to the rolling buffer', () => {
    const rolling: TelemetrySample[] = []
    ingestIncremental(rolling, [sample(100, 1), sample(200, 2)], 0)
    expect(rolling.map((s) => s.v.r)).toEqual([1, 2])
  })

  it('drops head samples older than windowStart', () => {
    const rolling: TelemetrySample[] = [sample(100, 1), sample(200, 2), sample(300, 3)]
    const dropped = ingestIncremental(rolling, [], 250)
    expect(dropped).toBe(2)
    expect(rolling.map((s) => s.v.r)).toEqual([3])
  })

  it('preserves chronological history within the window across many incremental calls', () => {
    const rolling: TelemetrySample[] = []
    let t = 1000
    for (let i = 0; i < 60; i += 1) {
      const windowStart = t - 3000
      ingestIncremental(rolling, [sample(t, i)], windowStart)
      t += 100
    }
    expect(rolling.length).toBeGreaterThanOrEqual(30)
    expect(rolling.length).toBeLessThanOrEqual(31)
    for (let i = 1; i < rolling.length; i += 1) {
      const prev = rolling[i - 1]
      const curr = rolling[i]
      if (prev === undefined || curr === undefined) {
        throw new Error('rolling buffer contained an undefined entry')
      }
      const prevR = prev.v.r
      const currR = curr.v.r
      if (prevR === undefined || currR === undefined) {
        throw new Error('rolling buffer entry is missing the r value')
      }
      expect(curr.t).toBeGreaterThan(prev.t)
      expect(currR).toBeGreaterThan(prevR)
    }
    expect(rolling[rolling.length - 1]?.v.r).toBe(59)
  })

  it('is a no-op when no fresh samples and all existing samples are within the window', () => {
    const rolling: TelemetrySample[] = [sample(900, 1), sample(950, 2), sample(1000, 3)]
    const dropped = ingestIncremental(rolling, [], 500)
    expect(dropped).toBe(0)
    expect(rolling.map((s) => s.v.r)).toEqual([1, 2, 3])
  })

  it('handles fresh samples that are themselves older than the window (extreme edge)', () => {
    const rolling: TelemetrySample[] = [sample(900, 1)]
    ingestIncremental(rolling, [sample(800, 0), sample(1000, 2)], 950)
    expect(rolling.map((s) => s.v.r)).toEqual([2])
  })
})

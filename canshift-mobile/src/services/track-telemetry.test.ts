import { TrackTelemetrySchema } from '@tmbk/canshift-core'
import type { LapRecord } from '../stores/track-session.store'
import { buildTrackTelemetry } from './track-telemetry'

const lap = (number: number, startMs: number, durationMs: number): LapRecord => ({
  number,
  startMs,
  endMs: startMs + durationMs,
  durationMs,
})

describe('buildTrackTelemetry', () => {
  it('returns just trackMode=false when idle', () => {
    const result = buildTrackTelemetry({
      recording: false,
      sessionStartMs: 0,
      laps: [],
      bestLapMs: 0,
      nowMs: 0,
    })
    expect(result).toEqual({ trackMode: false })
  })

  it('emits currentLapMs starting at 0 from sessionStartMs when no lap completed', () => {
    const result = buildTrackTelemetry({
      recording: true,
      sessionStartMs: 1000,
      laps: [],
      bestLapMs: 0,
      nowMs: 1500,
    })
    expect(result).toEqual({
      trackMode: true,
      currentLapMs: 500,
      lapNumber: 0,
    })
  })

  it('clamps currentLapMs to 0 against clock skew', () => {
    const result = buildTrackTelemetry({
      recording: true,
      sessionStartMs: 5000,
      laps: [],
      bestLapMs: 0,
      nowMs: 1000,
    })
    expect(result.currentLapMs).toBe(0)
  })

  it('exposes lastLapMs and bestLapMs after the first crossing', () => {
    const result = buildTrackTelemetry({
      recording: true,
      sessionStartMs: 0,
      laps: [lap(1, 0, 90_000)],
      bestLapMs: 90_000,
      nowMs: 95_000,
    })
    expect(result).toEqual({
      trackMode: true,
      currentLapMs: 5000,
      lapNumber: 1,
      lastLapMs: 90_000,
      bestLapMs: 90_000,
      deltaMs: 5000 - 90_000,
    })
  })

  it('emits a positive delta when the current lap is slower than best', () => {
    const laps = [lap(1, 0, 80_000), lap(2, 80_000, 85_000)]
    const result = buildTrackTelemetry({
      recording: true,
      sessionStartMs: 0,
      laps,
      bestLapMs: 80_000,
      nowMs: 165_000 + 1500,
    })
    expect(result.currentLapMs).toBe(1500)
    expect(result.deltaMs).toBe(1500 - 80_000)
    expect(result.lapNumber).toBe(2)
    expect(result.lastLapMs).toBe(85_000)
  })

  it('emits a negative delta when ahead of best mid-lap', () => {
    const result = buildTrackTelemetry({
      recording: true,
      sessionStartMs: 0,
      laps: [lap(1, 0, 90_000)],
      bestLapMs: 90_000,
      nowMs: 92_000,
    })
    expect(result.currentLapMs).toBe(2000)
    expect(result.deltaMs).toBe(2000 - 90_000)
  })

  it('omits delta when no best is set yet', () => {
    const result = buildTrackTelemetry({
      recording: true,
      sessionStartMs: 0,
      laps: [],
      bestLapMs: 0,
      nowMs: 1000,
    })
    expect(result.deltaMs).toBeUndefined()
    expect(result.bestLapMs).toBeUndefined()
  })

  it('forwards the bestLapPulse flag verbatim', () => {
    const result = buildTrackTelemetry({
      recording: true,
      sessionStartMs: 0,
      laps: [lap(1, 0, 80_000)],
      bestLapMs: 80_000,
      nowMs: 80_500,
      bestLapPulse: true,
    })
    expect(result.isBestLap).toBe(true)
  })

  it('omits isBestLap when the pulse flag is false or absent', () => {
    expect(
      buildTrackTelemetry({
        recording: true,
        sessionStartMs: 0,
        laps: [],
        bestLapMs: 0,
        nowMs: 100,
        bestLapPulse: false,
      }).isBestLap
    ).toBeUndefined()

    expect(
      buildTrackTelemetry({
        recording: true,
        sessionStartMs: 0,
        laps: [],
        bestLapMs: 0,
        nowMs: 100,
      }).isBestLap
    ).toBeUndefined()
  })

  it('produces a payload that validates against TrackTelemetrySchema in core', () => {
    const result = buildTrackTelemetry({
      recording: true,
      sessionStartMs: 0,
      laps: [lap(1, 0, 80_000), lap(2, 80_000, 78_000)],
      bestLapMs: 78_000,
      nowMs: 158_000 + 2500,
      bestLapPulse: true,
    })
    expect(TrackTelemetrySchema.safeParse(result).success).toBe(true)
  })
})

import type { TrackTelemetry } from '@tmbk/canshift-core'
import type { LapRecord } from '../stores/track-session.store'

export interface BuildTrackTelemetryInput {
  recording: boolean
  sessionStartMs: number
  laps: readonly LapRecord[]
  bestLapMs: number
  nowMs: number
  bestLapPulse?: boolean
}

const inProgressLapStartMs = (laps: readonly LapRecord[], sessionStartMs: number): number => {
  if (laps.length === 0) return sessionStartMs
  const last = laps[laps.length - 1]
  return last !== undefined ? last.endMs : sessionStartMs
}

export const buildTrackTelemetry = (input: BuildTrackTelemetryInput): TrackTelemetry => {
  const { recording, sessionStartMs, laps, bestLapMs, nowMs, bestLapPulse } = input
  const payload: TrackTelemetry = { trackMode: recording }
  if (!recording) return payload

  const lapStartMs = inProgressLapStartMs(laps, sessionStartMs)
  const currentLapMs = Math.max(0, Math.floor(nowMs - lapStartMs))
  payload.currentLapMs = currentLapMs
  payload.lapNumber = laps.length

  if (laps.length > 0) {
    const lastLap = laps[laps.length - 1]
    if (lastLap !== undefined) payload.lastLapMs = lastLap.durationMs
  }

  if (bestLapMs > 0) {
    payload.bestLapMs = bestLapMs
    payload.deltaMs = currentLapMs - bestLapMs
  }

  if (bestLapPulse === true) payload.isBestLap = true

  return payload
}

// track-telemetry.ts — Pure builder that maps the live track-session
// store state to a `TrackTelemetry` payload (#887 part 3 / #845 layer 4).
//
// The function is pure for testability — callers (the future BLE
// publisher) pass the current store snapshot plus the wall clock. The
// publisher is responsible for:
//   1) snapshotting the store (or selecting via Zustand),
//   2) tracking the "new best lap just clocked" pulse flag,
//   3) writing the validated payload to the BLE TRACK characteristic.

import type { TrackTelemetry } from '@tmbk/canshift-core'
import type { LapRecord } from '../stores/track-session.store'

export interface BuildTrackTelemetryInput {
  /** Whether a session is currently recording. */
  recording: boolean
  /** Wall-clock ms at which the active session began (0 when idle). */
  sessionStartMs: number
  /** Completed laps in chronological order; empty before the first S/F crossing. */
  laps: readonly LapRecord[]
  /** Best lap duration in ms; 0 when no lap completed yet. */
  bestLapMs: number
  /** Wall-clock ms used to derive `currentLapMs`. */
  nowMs: number
  /**
   * One-shot pulse flag set by the publisher for the single frame where a
   * new best lap was clocked. The builder forwards it verbatim; pulse
   * bookkeeping is the publisher's responsibility.
   */
  bestLapPulse?: boolean
}

/** Wall-clock ms at which the in-progress (un-finished) lap began. */
function inProgressLapStartMs(laps: readonly LapRecord[], sessionStartMs: number): number {
  if (laps.length === 0) return sessionStartMs
  const last = laps[laps.length - 1]
  return last !== undefined ? last.endMs : sessionStartMs
}

/**
 * Build the TrackTelemetry payload for the given snapshot. The result is
 * the input the future BLE publisher hands to the firmware via the TRACK
 * characteristic — fields stay optional when there's no meaningful value
 * yet (e.g. `currentLapMs` is undefined while idle).
 *
 * `currentLapMs` is computed as `nowMs - inProgressLapStartMs(...)`, clamped
 * to 0 to defend against clock skew. `deltaMs` is the signed difference
 * between the current lap and the best; when no best is set the field is
 * omitted (the firmware draws no delta arc until the second lap finishes).
 */
export function buildTrackTelemetry(input: BuildTrackTelemetryInput): TrackTelemetry {
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

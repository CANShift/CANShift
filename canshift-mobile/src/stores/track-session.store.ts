// track-session.store.ts — In-memory recorder for a Track-mode session
// (#845).
//
// Holds the GPS samples the user accumulates during a single recording
// session plus the derived lap state. Pure data layer — no GPS hardware
// access, no BLE side-effects, no UI. A second PR wires `pushSample` to
// `expo-location` updates; this module already gates fine in unit tests
// via direct calls to `pushSample`.
//
// Storage model: a fixed-capacity ring buffer keeps the in-flight GPS
// trace bounded. Lap timestamps are kept separately so they survive even
// when the underlying samples roll off the ring.

import { create } from 'zustand'

/** Maximum retained GPS samples — ~30 min at 5 Hz. Older samples are evicted. */
export const MAX_GPS_SAMPLES = 9000

/** Single GPS reading. Times are `Date.now()` milliseconds; lat/lng decimal degrees. */
export interface GpsSample {
  /** Wall-clock ms. */
  t: number
  lat: number
  lng: number
  /** Ground speed in m/s — kept SI to defer km/h vs mph until display. */
  speedMs: number
  /** Heading in degrees [0, 360); 0 = north. */
  headingDeg: number
}

/** Outcome of one completed lap. `endMs - startMs === durationMs`. */
export interface LapRecord {
  number: number // 1-indexed; first finished lap = 1
  startMs: number
  endMs: number
  durationMs: number
}

interface TrackSessionState {
  /** True between `startSession()` and `stopSession()`. */
  recording: boolean
  /** Wall-clock ms at which the active session began (0 when not recording). */
  sessionStartMs: number
  /** Index of the first GPS sample that belongs to the current session. */
  sessionStartSampleIndex: number
  laps: LapRecord[]
  /** Best lap so far in the current session (ms); 0 = no completed lap yet. */
  bestLapMs: number
  /** Total samples pushed since boot (monotonic, never wraps). */
  writeIndex: number
}

// ---------------------------------------------------------------------------
// Sample ring buffer (module-level, off the store to avoid Zustand re-render
// at 5 Hz)
// ---------------------------------------------------------------------------

const samples: (GpsSample | undefined)[] = new Array<GpsSample | undefined>(MAX_GPS_SAMPLES)
let head = 0
let size = 0
let writeIndex = 0

// ---------------------------------------------------------------------------
// Zustand store — surfaces session lifecycle + lap list. Recording flag and
// laps array drive UI re-renders; GPS samples themselves are read on demand
// via `getRecentSamples`.
// ---------------------------------------------------------------------------

export const useTrackSessionStore = create<TrackSessionState>(() => ({
  recording: false,
  sessionStartMs: 0,
  sessionStartSampleIndex: 0,
  laps: [],
  bestLapMs: 0,
  writeIndex: 0,
}))

// ---------------------------------------------------------------------------
// Session control
// ---------------------------------------------------------------------------

export function startSession(nowMs: number = Date.now()): void {
  useTrackSessionStore.setState({
    recording: true,
    sessionStartMs: nowMs,
    sessionStartSampleIndex: writeIndex,
    laps: [],
    bestLapMs: 0,
  })
}

export function stopSession(): void {
  useTrackSessionStore.setState({ recording: false })
}

export function clearAll(): void {
  for (let i = 0; i < MAX_GPS_SAMPLES; i += 1) samples[i] = undefined
  head = 0
  size = 0
  writeIndex = 0
  useTrackSessionStore.setState({
    recording: false,
    sessionStartMs: 0,
    sessionStartSampleIndex: 0,
    laps: [],
    bestLapMs: 0,
    writeIndex: 0,
  })
}

// ---------------------------------------------------------------------------
// Sample ingest — called once per GPS update (from the future expo-location
// subscription, or directly from tests). The store's `writeIndex` is bumped
// so subscribers can detect new data without copying the buffer.
// ---------------------------------------------------------------------------

export function pushSample(sample: GpsSample): void {
  samples[head] = { ...sample }
  head = (head + 1) % MAX_GPS_SAMPLES
  if (size < MAX_GPS_SAMPLES) size += 1
  writeIndex += 1
  // Surface the new index so UI hooks can re-render once per push without a
  // separate timer. Cheaper than putting the whole sample on the store.
  useTrackSessionStore.setState({ writeIndex })
}

// ---------------------------------------------------------------------------
// Sample readers
// ---------------------------------------------------------------------------

/** Total GPS samples pushed since the last `clearAll`. Monotonic. */
export function getWriteIndex(): number {
  return writeIndex
}

/** Sample at the given monotonic index, or undefined when out of window. */
export function getSampleAt(monotonicIndex: number): GpsSample | undefined {
  if (size === 0) return undefined
  const oldestAvailable = writeIndex - size
  if (monotonicIndex < oldestAvailable || monotonicIndex >= writeIndex) return undefined
  const offset = writeIndex - monotonicIndex // 1..size
  const ringIdx = (head - offset + MAX_GPS_SAMPLES) % MAX_GPS_SAMPLES
  return samples[ringIdx]
}

/**
 * Returns samples with monotonic index in `[fromIndex, toIndex)`. Clamps to
 * the retained window — older indices are silently dropped. Returned in
 * chronological order.
 */
export function getRange(fromIndex: number, toIndex: number): readonly GpsSample[] {
  if (toIndex <= fromIndex || size === 0) return []
  const oldestAvailable = writeIndex - size
  const from = Math.max(fromIndex, oldestAvailable)
  const to = Math.min(toIndex, writeIndex)
  if (to <= from) return []
  const count = to - from
  const out: GpsSample[] = new Array<GpsSample>(count)
  for (let i = 0; i < count; i += 1) {
    const monotonic = from + i
    const sample = getSampleAt(monotonic)
    if (sample !== undefined) out[i] = sample
  }
  return out
}

// ---------------------------------------------------------------------------
// Lap recording
// ---------------------------------------------------------------------------

/**
 * Record a finished lap. Updates `bestLapMs` when the new lap improves on
 * the current best. The caller (lap-detection module — separate file) is
 * responsible for deciding *when* a lap finished; this routine only
 * persists the record.
 */
export function recordLap(startMs: number, endMs: number): LapRecord {
  const durationMs = endMs - startMs
  const state = useTrackSessionStore.getState()
  const number = state.laps.length + 1
  const lap: LapRecord = { number, startMs, endMs, durationMs }
  const nextLaps = [...state.laps, lap]
  const nextBest =
    state.bestLapMs === 0 || durationMs < state.bestLapMs ? durationMs : state.bestLapMs
  useTrackSessionStore.setState({ laps: nextLaps, bestLapMs: nextBest })
  return lap
}

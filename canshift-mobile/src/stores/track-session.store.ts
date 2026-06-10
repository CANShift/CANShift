import { create } from 'zustand'

export const MAX_GPS_SAMPLES = 9000

export interface GpsSample {
  t: number
  lat: number
  lng: number
  speedMs: number
  headingDeg: number
}

export interface LapRecord {
  number: number
  startMs: number
  endMs: number
  durationMs: number
}

interface TrackSessionState {
  recording: boolean
  sessionStartMs: number
  sessionStartSampleIndex: number
  laps: LapRecord[]
  bestLapMs: number
  writeIndex: number
}

const samples: (GpsSample | undefined)[] = new Array<GpsSample | undefined>(MAX_GPS_SAMPLES)
let head = 0
let size = 0
let writeIndex = 0

export const useTrackSessionStore = create<TrackSessionState>(() => ({
  recording: false,
  sessionStartMs: 0,
  sessionStartSampleIndex: 0,
  laps: [],
  bestLapMs: 0,
  writeIndex: 0,
}))

export const startSession = (nowMs: number = Date.now()): void => {
  useTrackSessionStore.setState({
    recording: true,
    sessionStartMs: nowMs,
    sessionStartSampleIndex: writeIndex,
    laps: [],
    bestLapMs: 0,
  })
}

export const stopSession = (): void => {
  useTrackSessionStore.setState({ recording: false })
}

export const clearAll = (): void => {
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

export const pushSample = (sample: GpsSample): void => {
  samples[head] = { ...sample }
  head = (head + 1) % MAX_GPS_SAMPLES
  if (size < MAX_GPS_SAMPLES) size += 1
  writeIndex += 1
  useTrackSessionStore.setState({ writeIndex })
}

export const getWriteIndex = (): number => {
  return writeIndex
}

export const getSampleAt = (monotonicIndex: number): GpsSample | undefined => {
  if (size === 0) return undefined
  const oldestAvailable = writeIndex - size
  if (monotonicIndex < oldestAvailable || monotonicIndex >= writeIndex) return undefined
  const offset = writeIndex - monotonicIndex
  const ringIdx = (head - offset + MAX_GPS_SAMPLES) % MAX_GPS_SAMPLES
  return samples[ringIdx]
}

export const getRange = (fromIndex: number, toIndex: number): readonly GpsSample[] => {
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

export const recordLap = (startMs: number, endMs: number): LapRecord => {
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

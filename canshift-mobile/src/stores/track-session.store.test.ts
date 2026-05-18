// track-session.store.test.ts — Coverage for the recorder ring buffer +
// session lifecycle from #845.

import {
  MAX_GPS_SAMPLES,
  clearAll,
  getRange,
  getSampleAt,
  getWriteIndex,
  pushSample,
  recordLap,
  startSession,
  stopSession,
  useTrackSessionStore,
} from './track-session.store'

const sample = (t: number, lat = 0, lng = 0) => ({ t, lat, lng, speedMs: 0, headingDeg: 0 })

describe('track-session.store', () => {
  beforeEach(() => {
    clearAll()
  })

  it('starts in the "not recording" state with no laps', () => {
    const state = useTrackSessionStore.getState()
    expect(state.recording).toBe(false)
    expect(state.laps).toEqual([])
    expect(state.bestLapMs).toBe(0)
    expect(getWriteIndex()).toBe(0)
  })

  describe('session lifecycle', () => {
    it('startSession() flips recording on and stamps sessionStartMs', () => {
      startSession(1700)
      const state = useTrackSessionStore.getState()
      expect(state.recording).toBe(true)
      expect(state.sessionStartMs).toBe(1700)
      expect(state.sessionStartSampleIndex).toBe(0)
    })

    it('stopSession() flips recording off but preserves laps', () => {
      startSession(0)
      recordLap(0, 1000)
      stopSession()
      const state = useTrackSessionStore.getState()
      expect(state.recording).toBe(false)
      expect(state.laps).toHaveLength(1)
    })

    it('clearAll() wipes laps, samples, and recording state', () => {
      startSession(0)
      pushSample(sample(100))
      recordLap(0, 500)
      clearAll()
      const state = useTrackSessionStore.getState()
      expect(state.recording).toBe(false)
      expect(state.laps).toEqual([])
      expect(getWriteIndex()).toBe(0)
    })
  })

  describe('pushSample + ring buffer', () => {
    it('writes a defensive copy of the sample', () => {
      const original = sample(100, 1, 2)
      pushSample(original)
      original.lat = 999
      expect(getSampleAt(0)?.lat).toBe(1)
    })

    it('bumps writeIndex monotonically per push', () => {
      pushSample(sample(100))
      pushSample(sample(200))
      pushSample(sample(300))
      expect(getWriteIndex()).toBe(3)
    })

    it('exposes the new writeIndex on the store state', () => {
      pushSample(sample(100))
      pushSample(sample(200))
      expect(useTrackSessionStore.getState().writeIndex).toBe(2)
    })

    it('caps the buffer at MAX_GPS_SAMPLES, dropping the oldest first', () => {
      for (let i = 0; i < MAX_GPS_SAMPLES + 50; i += 1) pushSample(sample(i))
      // Oldest 50 are evicted; getSampleAt(49) is below the window.
      expect(getSampleAt(49)).toBeUndefined()
      expect(getSampleAt(50)?.t).toBe(50)
      expect(getSampleAt(MAX_GPS_SAMPLES + 49)?.t).toBe(MAX_GPS_SAMPLES + 49)
    })
  })

  describe('getRange', () => {
    it('returns samples in chronological order', () => {
      pushSample(sample(100))
      pushSample(sample(200))
      pushSample(sample(300))
      const out = getRange(0, 3)
      expect(out.map((s) => s.t)).toEqual([100, 200, 300])
    })

    it('clamps fromIndex to the oldest retained sample', () => {
      for (let i = 0; i < MAX_GPS_SAMPLES + 10; i += 1) pushSample(sample(i))
      const out = getRange(0, getWriteIndex())
      expect(out).toHaveLength(MAX_GPS_SAMPLES)
      expect(out[0]?.t).toBe(10)
    })

    it('returns an empty array for an empty range', () => {
      pushSample(sample(100))
      expect(getRange(0, 0)).toEqual([])
      expect(getRange(5, 3)).toEqual([])
    })

    it('returns chronologically ordered samples after a ring wrap', () => {
      for (let i = 0; i < MAX_GPS_SAMPLES + 5; i += 1) pushSample(sample(i))
      const wi = getWriteIndex()
      const out = getRange(wi - 10, wi)
      expect(out).toHaveLength(10)
      expect(out.map((s) => s.t)).toEqual([
        wi - 10,
        wi - 9,
        wi - 8,
        wi - 7,
        wi - 6,
        wi - 5,
        wi - 4,
        wi - 3,
        wi - 2,
        wi - 1,
      ])
    })
  })

  describe('recordLap', () => {
    it('appends the lap and updates bestLapMs on first call', () => {
      startSession(0)
      const lap = recordLap(0, 1500)
      expect(lap.number).toBe(1)
      expect(lap.durationMs).toBe(1500)
      expect(useTrackSessionStore.getState().bestLapMs).toBe(1500)
    })

    it('keeps bestLapMs when a slower lap is recorded', () => {
      startSession(0)
      recordLap(0, 1500)
      recordLap(1500, 3300) // 1800 ms — slower
      expect(useTrackSessionStore.getState().bestLapMs).toBe(1500)
    })

    it('updates bestLapMs when a faster lap is recorded', () => {
      startSession(0)
      recordLap(0, 1500)
      recordLap(1500, 2900) // 1400 ms — faster
      expect(useTrackSessionStore.getState().bestLapMs).toBe(1400)
    })

    it('increments lap numbers sequentially', () => {
      startSession(0)
      recordLap(0, 1000)
      recordLap(1000, 2000)
      recordLap(2000, 3000)
      const laps = useTrackSessionStore.getState().laps
      expect(laps.map((l) => l.number)).toEqual([1, 2, 3])
    })
  })
})

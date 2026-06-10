import type { TrackTelemetry } from '@tmbk/canshift-core'
import {
  clearAll,
  recordLap,
  startSession,
  stopSession,
  useTrackSessionStore,
} from '../stores/track-session.store'
import { createTrackTelemetryPublisher } from './track-telemetry-publisher'

const makeWriter = (): {
  write: jest.Mock<Promise<void>, [TrackTelemetry]>
  payloads: TrackTelemetry[]
} => {
  const payloads: TrackTelemetry[] = []
  const write = jest.fn((payload: TrackTelemetry) => {
    payloads.push(payload)
    return Promise.resolve()
  })
  return { write, payloads }
}

describe('createTrackTelemetryPublisher', () => {
  beforeEach(() => {
    clearAll()
    jest.useRealTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('tickNow', () => {
    it('writes a payload describing the current store state', async () => {
      const { write, payloads } = makeWriter()
      const pub = createTrackTelemetryPublisher({ write, now: () => 5000 })

      startSession(0)
      await pub.tickNow()

      expect(payloads).toEqual([{ trackMode: true, currentLapMs: 5000, lapNumber: 0 }])
    })

    it('fires bestLapPulse exactly once after a new personal-best lap', async () => {
      const { write, payloads } = makeWriter()
      let clock = 0
      const pub = createTrackTelemetryPublisher({ write, now: () => clock })

      startSession(0)
      clock = 1000
      await pub.tickNow()
      expect(payloads.at(-1)?.isBestLap).toBeUndefined()

      recordLap(0, 80_000)
      clock = 80_500
      await pub.tickNow()
      expect(payloads.at(-1)?.isBestLap).toBe(true)

      clock = 81_000
      await pub.tickNow()
      expect(payloads.at(-1)?.isBestLap).toBeUndefined()

      recordLap(80_000, 165_000)
      clock = 165_500
      await pub.tickNow()
      expect(payloads.at(-1)?.isBestLap).toBeUndefined()

      recordLap(165_000, 243_000)
      clock = 243_500
      await pub.tickNow()
      expect(payloads.at(-1)?.isBestLap).toBe(true)
    })

    it('routes write failures through the onError sink without throwing', async () => {
      const err = new Error('GATT busy')
      const write = jest.fn<Promise<void>, [TrackTelemetry]>(() => Promise.reject(err))
      const onError = jest.fn()
      const pub = createTrackTelemetryPublisher({ write, onError, now: () => 0 })

      startSession(0)
      await expect(pub.tickNow()).resolves.toBeUndefined()
      expect(onError).toHaveBeenCalledWith(err)
    })

    it('consumes the pulse even when the write fails — firmware will not be re-pulsed', async () => {
      const write = jest.fn<Promise<void>, [TrackTelemetry]>(() => Promise.reject(new Error('x')))
      const onError = jest.fn()
      let clock = 0
      const pub = createTrackTelemetryPublisher({ write, onError, now: () => clock })

      startSession(0)
      recordLap(0, 80_000)
      clock = 80_500
      await pub.tickNow()
      const firstCall = write.mock.calls[0]?.[0]
      expect(firstCall?.isBestLap).toBe(true)

      clock = 81_000
      await pub.tickNow()
      const secondCall = write.mock.calls[1]?.[0]
      expect(secondCall?.isBestLap).toBeUndefined()
    })
  })

  describe('start / stop', () => {
    it('start() emits an immediate payload and schedules a recurring tick', async () => {
      jest.useFakeTimers()
      const { write } = makeWriter()
      const pub = createTrackTelemetryPublisher({ write, intervalMs: 1000, now: () => 0 })

      startSession(0)
      pub.start()
      await Promise.resolve()
      await Promise.resolve()
      expect(write).toHaveBeenCalledTimes(1)

      jest.advanceTimersByTime(1000)
      await Promise.resolve()
      await Promise.resolve()
      expect(write).toHaveBeenCalledTimes(2)

      pub.stop()
      jest.advanceTimersByTime(5000)
      await Promise.resolve()
      expect(write).toHaveBeenCalledTimes(2)
    })

    it('start() is idempotent — a second call does not stack a second timer', async () => {
      jest.useFakeTimers()
      const { write } = makeWriter()
      const pub = createTrackTelemetryPublisher({ write, intervalMs: 1000, now: () => 0 })

      startSession(0)
      pub.start()
      pub.start()
      await Promise.resolve()
      await Promise.resolve()
      expect(write).toHaveBeenCalledTimes(1)

      jest.advanceTimersByTime(1000)
      await Promise.resolve()
      await Promise.resolve()
      expect(write).toHaveBeenCalledTimes(2)
    })

    it('stop() resets pulse tracking — restart treats the next new best as fresh', async () => {
      const { write, payloads } = makeWriter()
      let clock = 0
      const pub = createTrackTelemetryPublisher({ write, now: () => clock })

      startSession(0)
      recordLap(0, 80_000)
      clock = 80_500
      await pub.tickNow()

      pub.stop()
      stopSession()
      clearAll()

      startSession(0)
      recordLap(0, 78_000)
      clock = 79_000
      await pub.tickNow()
      expect(payloads.at(-1)?.isBestLap).toBe(true)
    })

    it('stop() before start() is safe — no-op', () => {
      const { write } = makeWriter()
      const pub = createTrackTelemetryPublisher({ write })
      expect(() => {
        pub.stop()
      }).not.toThrow()
    })
  })

  it('snapshots the live store on each tick — late updates show up next tick', async () => {
    const { write, payloads } = makeWriter()
    let clock = 0
    const pub = createTrackTelemetryPublisher({ write, now: () => clock })

    startSession(0)
    clock = 1000
    await pub.tickNow()
    expect(payloads.at(-1)?.lapNumber).toBe(0)

    recordLap(0, 80_000)
    clock = 80_500
    await pub.tickNow()
    expect(payloads.at(-1)?.lapNumber).toBe(1)
    expect(payloads.at(-1)?.lastLapMs).toBe(80_000)
  })

  it('emits trackMode=false after stopSession()', async () => {
    const { write, payloads } = makeWriter()
    const pub = createTrackTelemetryPublisher({ write, now: () => 0 })

    startSession(0)
    await pub.tickNow()
    stopSession()
    await pub.tickNow()
    expect(payloads.at(-1)).toEqual({ trackMode: false })
    expect(useTrackSessionStore.getState().recording).toBe(false)
  })
})

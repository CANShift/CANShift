import { act, renderHook } from '@testing-library/react-native'
import { useTrackSessionStore, clearAll } from '../stores/track-session.store'
import type { LapRecord } from '../stores/track-session.store'
import { useCurrentLapMs } from './use-current-lap-ms'

const lap = (number: number, startMs: number, endMs: number): LapRecord => ({
  number,
  startMs,
  endMs,
  durationMs: endMs - startMs,
})

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(10_000)
  clearAll()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('useCurrentLapMs', () => {
  it('returns 0 while not recording', () => {
    const { result } = renderHook(() => useCurrentLapMs())
    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(result.current).toBe(0)
  })

  it('ticks forward from session start while recording', () => {
    useTrackSessionStore.setState({ recording: true, sessionStartMs: 10_000 })
    const { result } = renderHook(() => useCurrentLapMs())
    act(() => {
      jest.advanceTimersByTime(750)
    })
    expect(result.current).toBe(750)
  })

  it('restarts from the last lap end when a lap is recorded', () => {
    useTrackSessionStore.setState({ recording: true, sessionStartMs: 10_000 })
    const { result } = renderHook(() => useCurrentLapMs())
    act(() => {
      jest.advanceTimersByTime(2_000)
    })
    act(() => {
      useTrackSessionStore.setState({ laps: [lap(1, 10_000, 11_500)] })
    })
    act(() => {
      jest.advanceTimersByTime(100)
    })
    expect(result.current).toBe(12_100 - 11_500)
  })

  it('resets to 0 when recording stops', () => {
    useTrackSessionStore.setState({ recording: true, sessionStartMs: 10_000 })
    const { result } = renderHook(() => useCurrentLapMs())
    act(() => {
      jest.advanceTimersByTime(400)
    })
    act(() => {
      useTrackSessionStore.setState({ recording: false })
    })
    expect(result.current).toBe(0)
  })
})

import { elapsedMsOf, useTimerStore } from './timer.store'

const initialState = useTimerStore.getState()

const elapsed = (): number => elapsedMsOf(useTimerStore.getState())

describe('useTimerStore', () => {
  beforeEach(() => {
    useTimerStore.setState(initialState, true)
    jest.useFakeTimers()
    jest.setSystemTime(0)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('starts idle with a zero elapsed baseline', () => {
    const state = useTimerStore.getState()
    expect(state.status).toBe('idle')
    expect(state.accumulatedMs).toBe(0)
    expect(state.startedAt).toBeNull()
    expect(elapsed()).toBe(0)
  })

  it('start() runs the clock and elapsed advances with wall time', () => {
    useTimerStore.getState().start()
    expect(useTimerStore.getState().status).toBe('running')
    jest.setSystemTime(5000)
    expect(elapsed()).toBe(5000)
  })

  it('pause() freezes elapsed while paused', () => {
    useTimerStore.getState().start()
    jest.setSystemTime(5000)
    useTimerStore.getState().pause()
    expect(useTimerStore.getState().status).toBe('paused')
    jest.setSystemTime(9000)
    expect(elapsed()).toBe(5000)
  })

  it('resume() continues accumulating from the frozen value', () => {
    useTimerStore.getState().start()
    jest.setSystemTime(5000)
    useTimerStore.getState().pause()
    jest.setSystemTime(9000)
    useTimerStore.getState().resume()
    jest.setSystemTime(11000)
    expect(elapsed()).toBe(7000)
  })

  it('reset() zeroes elapsed and returns to idle', () => {
    useTimerStore.getState().start()
    jest.setSystemTime(5000)
    useTimerStore.getState().reset()
    const state = useTimerStore.getState()
    expect(state.status).toBe('idle')
    expect(state.accumulatedMs).toBe(0)
    expect(state.startedAt).toBeNull()
    expect(elapsed()).toBe(0)
  })

  it('toggle() cycles idle -> running -> paused -> running', () => {
    const { toggle } = useTimerStore.getState()
    toggle()
    expect(useTimerStore.getState().status).toBe('running')
    toggle()
    expect(useTimerStore.getState().status).toBe('paused')
    toggle()
    expect(useTimerStore.getState().status).toBe('running')
  })

  it('start() is a no-op while already running', () => {
    useTimerStore.getState().start()
    jest.setSystemTime(5000)
    useTimerStore.getState().start()
    expect(elapsed()).toBe(5000)
  })

  it('resume() is a no-op when not paused', () => {
    useTimerStore.getState().resume()
    expect(useTimerStore.getState().status).toBe('idle')
  })

  it('captureLocalLap() records split and total while running', () => {
    useTimerStore.getState().start()
    jest.setSystemTime(61000)
    const first = useTimerStore.getState().captureLocalLap()
    expect(first).toEqual({ sessionId: -1, index: 1, lapMs: 61000, totalMs: 61000 })

    jest.setSystemTime(100000)
    const second = useTimerStore.getState().captureLocalLap()
    expect(second).toEqual({ sessionId: -1, index: 2, lapMs: 39000, totalMs: 100000 })
    expect(useTimerStore.getState().laps).toHaveLength(2)
  })

  it('captureLocalLap() is rejected unless running', () => {
    expect(useTimerStore.getState().captureLocalLap()).toBeNull()
    useTimerStore.getState().start()
    jest.setSystemTime(1000)
    useTimerStore.getState().pause()
    expect(useTimerStore.getState().captureLocalLap()).toBeNull()
  })

  it('applyDeviceState() mirrors the dash state and marks the store synced', () => {
    jest.setSystemTime(10000)
    useTimerStore.getState().applyDeviceState({
      state: 'running',
      elapsedMs: 42000,
      lapCount: 0,
      sessionId: 3,
      version: 7,
    })
    const state = useTimerStore.getState()
    expect(state.status).toBe('running')
    expect(state.deviceSynced).toBe(true)
    expect(state.sessionId).toBe(3)
    jest.setSystemTime(12000)
    expect(elapsed()).toBe(44000)
  })

  it('applyDeviceState() clears the lap view on session change or reset', () => {
    useTimerStore.getState().applyDeviceLap({ sessionId: 3, index: 1, lapMs: 900, totalMs: 900 })
    expect(useTimerStore.getState().laps).toHaveLength(1)

    useTimerStore.getState().applyDeviceState({
      state: 'running',
      elapsedMs: 1000,
      lapCount: 1,
      sessionId: 3,
      version: 5,
    })
    expect(useTimerStore.getState().laps).toHaveLength(1)

    useTimerStore.getState().applyDeviceState({
      state: 'reset',
      elapsedMs: 0,
      lapCount: 0,
      sessionId: 3,
      version: 6,
    })
    expect(useTimerStore.getState().laps).toHaveLength(0)
  })

  it('applyDeviceLap() dedupes replayed laps and ignores foreign sessions', () => {
    useTimerStore.getState().applyDeviceState({
      state: 'running',
      elapsedMs: 5000,
      lapCount: 1,
      sessionId: 2,
      version: 4,
    })
    const lap = { sessionId: 2, index: 1, lapMs: 900, totalMs: 900 }
    useTimerStore.getState().applyDeviceLap(lap)
    useTimerStore.getState().applyDeviceLap(lap)
    useTimerStore.getState().applyDeviceLap({ sessionId: 9, index: 1, lapMs: 100, totalMs: 100 })
    expect(useTimerStore.getState().laps).toEqual([{ index: 1, lapMs: 900, totalMs: 900 }])
  })

  it('clearDeviceSync() keeps the last known state but drops the live flag', () => {
    useTimerStore.getState().applyDeviceState({
      state: 'running',
      elapsedMs: 5000,
      lapCount: 0,
      sessionId: 2,
      version: 4,
    })
    useTimerStore.getState().clearDeviceSync()
    const state = useTimerStore.getState()
    expect(state.deviceSynced).toBe(false)
    expect(state.status).toBe('running')
  })
})

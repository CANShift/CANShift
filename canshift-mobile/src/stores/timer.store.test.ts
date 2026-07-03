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
})

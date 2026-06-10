import { useReconnectStore } from './reconnect.store'

const initialState = useReconnectStore.getState()

describe('useReconnectStore', () => {
  beforeEach(() => {
    useReconnectStore.setState(initialState, true)
  })

  it('exposes a clean initial state', () => {
    const state = useReconnectStore.getState()
    expect(state.isReconnecting).toBe(false)
    expect(state.attempt).toBe(0)
    expect(state.maxAttempts).toBe(0)
    expect(state.deviceId).toBeNull()
  })

  it('start() flips isReconnecting on, resets attempt, and stores deviceId/maxAttempts', () => {
    useReconnectStore.setState({ attempt: 7 })
    useReconnectStore.getState().start('AA:BB:CC', 5)
    const state = useReconnectStore.getState()
    expect(state.isReconnecting).toBe(true)
    expect(state.attempt).toBe(0)
    expect(state.maxAttempts).toBe(5)
    expect(state.deviceId).toBe('AA:BB:CC')
  })

  it('setAttempt() updates only the attempt counter', () => {
    useReconnectStore.getState().start('AA:BB:CC', 5)
    useReconnectStore.getState().setAttempt(3)
    const state = useReconnectStore.getState()
    expect(state.attempt).toBe(3)
    expect(state.isReconnecting).toBe(true)
    expect(state.maxAttempts).toBe(5)
    expect(state.deviceId).toBe('AA:BB:CC')
  })

  it('stop() clears every field back to the idle baseline', () => {
    useReconnectStore.getState().start('AA:BB:CC', 5)
    useReconnectStore.getState().setAttempt(2)
    useReconnectStore.getState().stop()
    const state = useReconnectStore.getState()
    expect(state.isReconnecting).toBe(false)
    expect(state.attempt).toBe(0)
    expect(state.maxAttempts).toBe(0)
    expect(state.deviceId).toBeNull()
  })
})

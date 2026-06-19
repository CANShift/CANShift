import type { BleConnectionError } from '../services/ble.errors'
import { useDeviceStore } from './device.store'

const initialState = useDeviceStore.getState()

describe('useDeviceStore', () => {
  beforeEach(() => {
    useDeviceStore.setState(initialState, true)
  })

  it('exposes a clean initial state', () => {
    const state = useDeviceStore.getState()
    expect(state.connectionState).toBe('idle')
    expect(state.mode).toBe('idle')
    expect(state.deviceId).toBeNull()
    expect(state.deviceName).toBeNull()
    expect(state.firmwareVersion).toBeNull()
    expect(state.canHealthy).toBe(false)
    expect(state.isDayMode).toBeNull()
    expect(state.error).toBeNull()
  })

  it('setMode updates only the mode field', () => {
    useDeviceStore.getState().setMode('sim')
    expect(useDeviceStore.getState().mode).toBe('sim')
    useDeviceStore.getState().setMode('ble')
    expect(useDeviceStore.getState().mode).toBe('ble')
    useDeviceStore.getState().setMode('idle')
    expect(useDeviceStore.getState().mode).toBe('idle')
  })

  it('setConnectionState updates only the connection state', () => {
    useDeviceStore.getState().setConnectionState('scanning')
    expect(useDeviceStore.getState().connectionState).toBe('scanning')
    useDeviceStore.getState().setConnectionState('connecting')
    expect(useDeviceStore.getState().connectionState).toBe('connecting')
  })

  it('setDevice marks the device as connected and clears prior errors', () => {
    useDeviceStore.setState({
      error: { kind: 'bluetooth-off' },
      connectionState: 'error',
    })
    useDeviceStore.getState().setDevice('AA:BB:CC', 'CANShift-01')
    const state = useDeviceStore.getState()
    expect(state.deviceId).toBe('AA:BB:CC')
    expect(state.deviceName).toBe('CANShift-01')
    expect(state.connectionState).toBe('connected')
    expect(state.error).toBeNull()
  })

  it('setFirmwareStatus updates firmware version and CAN health flag', () => {
    useDeviceStore.getState().setFirmwareStatus('1.2.3', true)
    let state = useDeviceStore.getState()
    expect(state.firmwareVersion).toBe('1.2.3')
    expect(state.canHealthy).toBe(true)

    useDeviceStore.getState().setFirmwareStatus('1.2.4', false)
    state = useDeviceStore.getState()
    expect(state.firmwareVersion).toBe('1.2.4')
    expect(state.canHealthy).toBe(false)
  })

  it('setIsDayMode toggles day/night flag', () => {
    useDeviceStore.getState().setIsDayMode(true)
    expect(useDeviceStore.getState().isDayMode).toBe(true)
    useDeviceStore.getState().setIsDayMode(false)
    expect(useDeviceStore.getState().isDayMode).toBe(false)
  })

  it('setError stores the error and forces the connection state to "error"', () => {
    const err: BleConnectionError = { kind: 'permission-denied', platform: 'ios' }
    useDeviceStore.setState({ connectionState: 'connecting' })
    useDeviceStore.getState().setError(err)
    const state = useDeviceStore.getState()
    expect(state.error).toEqual(err)
    expect(state.connectionState).toBe('error')
  })

  it('setError(null) clears the error but keeps connection state at "error"', () => {
    useDeviceStore.getState().setError({ kind: 'bluetooth-off' })
    useDeviceStore.getState().setError(null)
    const state = useDeviceStore.getState()
    expect(state.error).toBeNull()
    expect(state.connectionState).toBe('error')
  })

  it('disconnect resets every field back to the initial idle state', () => {
    useDeviceStore.getState().setDevice('AA:BB:CC', 'CANShift-01')
    useDeviceStore.getState().setMode('ble')
    useDeviceStore.getState().setFirmwareStatus('1.2.3', true)
    useDeviceStore.getState().setIsDayMode(true)
    useDeviceStore.getState().setError({ kind: 'unknown', message: 'boom' })

    useDeviceStore.getState().disconnect()

    const state = useDeviceStore.getState()
    expect(state.connectionState).toBe('idle')
    expect(state.mode).toBe('idle')
    expect(state.deviceId).toBeNull()
    expect(state.deviceName).toBeNull()
    expect(state.firmwareVersion).toBeNull()
    expect(state.canHealthy).toBe(false)
    expect(state.isDayMode).toBeNull()
    expect(state.error).toBeNull()
  })
})

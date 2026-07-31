import { timerControl } from './timer-control'
import { useDeviceStore } from '../stores/device.store'
import { useTimerStore } from '../stores/timer.store'
import { setTimerSessionStorage, useTimerSessionsStore } from '../stores/timer-sessions.store'
import type { TimerSessionStorage } from './timer-session-storage'

const mockSendTimerCommand = jest.fn((_command: string) => Promise.resolve())

jest.mock('./ble.service', () => ({
  bleService: {
    sendTimerCommand: (command: string) => mockSendTimerCommand(command),
  },
}))

const memoryStorage: TimerSessionStorage = {
  load: () => Promise.resolve([]),
  save: () => Promise.resolve(),
}

const initialTimerState = useTimerStore.getState()
const initialDeviceState = useDeviceStore.getState()
const initialSessionsState = useTimerSessionsStore.getState()

describe('timerControl', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useTimerStore.setState(initialTimerState, true)
    useDeviceStore.setState(initialDeviceState, true)
    useTimerSessionsStore.setState(initialSessionsState, true)
    setTimerSessionStorage(memoryStorage)
  })

  const connectDevice = (): void => {
    useDeviceStore.setState({ connectionState: 'connected', mode: 'ble' })
  }

  it('routes commands over BLE when a device is connected', () => {
    connectDevice()
    timerControl.start()
    timerControl.lap()
    timerControl.reset()
    expect(mockSendTimerCommand.mock.calls.map((call) => call[0])).toEqual([
      'start',
      'lap',
      'reset',
    ])
    expect(useTimerStore.getState().status).toBe('idle')
  })

  it('drives the local store when no device is connected', () => {
    timerControl.start()
    expect(useTimerStore.getState().status).toBe('running')
    timerControl.pause()
    expect(useTimerStore.getState().status).toBe('paused')
    timerControl.resume()
    expect(useTimerStore.getState().status).toBe('running')
    timerControl.reset()
    expect(useTimerStore.getState().status).toBe('idle')
    expect(mockSendTimerCommand).not.toHaveBeenCalled()
  })

  it('persists local laps into the session store', () => {
    timerControl.start()
    timerControl.lap()
    expect(useTimerStore.getState().laps).toHaveLength(1)
    expect(useTimerSessionsStore.getState().sessions).toHaveLength(1)
  })

  it('does not persist a session bucket for a rejected local lap', () => {
    timerControl.lap()
    expect(useTimerSessionsStore.getState().sessions).toHaveLength(0)
  })
})

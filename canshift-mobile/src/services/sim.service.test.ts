import { start, stop, isRunning } from './sim.service'
import { useDeviceStore } from '../stores/device.store'
import { useSignalsStore } from '../stores/signals.store'
import { useLogStore } from '../stores/log.store'

describe('sim.service', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    useLogStore.getState().clear()
  })

  afterEach(() => {
    stop()
    jest.useRealTimers()
  })

  it('starts a single tick interval and reports running', () => {
    start()
    expect(isRunning()).toBe(true)
    expect(jest.getTimerCount()).toBe(1)
    expect(useDeviceStore.getState().mode).toBe('sim')
  })

  it('ignores start() while already running', () => {
    start()
    start()
    expect(jest.getTimerCount()).toBe(1)

    const startedLogs = useLogStore
      .getState()
      .entries.filter((e) => e.message.includes('Simulation mode started'))
    expect(startedLogs).toHaveLength(1)
  })

  it('emits telemetry on tick', () => {
    start()
    jest.advanceTimersByTime(100)
    expect(useSignalsStore.getState().values.r).toBeGreaterThan(0)
  })

  it('stop() clears the interval and allows a fresh start', () => {
    start()
    stop()
    expect(isRunning()).toBe(false)
    expect(jest.getTimerCount()).toBe(0)

    start()
    expect(isRunning()).toBe(true)
    expect(jest.getTimerCount()).toBe(1)
  })
})

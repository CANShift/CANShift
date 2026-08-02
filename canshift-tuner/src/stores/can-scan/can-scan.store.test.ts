import { beforeEach, describe, expect, it, vi } from 'vitest'

const startMock = vi.fn()
const stopMock = vi.fn()

vi.mock('../../transport', () => ({
  canScannerIpc: {
    start: (): Promise<{ success: boolean; error?: string }> => startMock(),
    stop: (): Promise<{ success: boolean; error?: string }> => stopMock(),
  },
  deviceEvents: {
    onCanFrame: () => () => undefined,
  },
}))

import { useCanScanStore } from './can-scan.store'
import { useDeviceStore } from '../device.store'

const connectDevice = () => {
  useDeviceStore.setState({ connected: true, simulationMode: false })
}

describe('can-scan store race handling', () => {
  beforeEach(() => {
    startMock.mockReset()
    stopMock.mockReset()
    stopMock.mockResolvedValue({ success: true })
    useCanScanStore.setState({ status: 'idle', error: null })
  })

  it('abandons a start whose IPC resolves after a stop began, and stops the device scan', async () => {
    connectDevice()
    let resolveStart: (r: { success: boolean }) => void = () => undefined
    startMock.mockReturnValue(
      new Promise((resolve) => {
        resolveStart = resolve
      })
    )

    const starting = useCanScanStore.getState().start()
    expect(useCanScanStore.getState().status).toBe('starting')

    const stopping = useCanScanStore.getState().stop()
    resolveStart({ success: true })
    await Promise.all([starting, stopping])

    expect(useCanScanStore.getState().status).toBe('idle')
    expect(stopMock.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('refuses to start while a stop is in flight', async () => {
    connectDevice()
    useCanScanStore.setState({ status: 'stopping' })

    await useCanScanStore.getState().start()

    expect(startMock).not.toHaveBeenCalled()
    expect(useCanScanStore.getState().status).toBe('stopping')
  })

  it('surfaces the start error in state', async () => {
    connectDevice()
    startMock.mockResolvedValue({ success: false, error: 'port_busy' })

    await useCanScanStore.getState().start()

    expect(useCanScanStore.getState().status).toBe('error')
    expect(useCanScanStore.getState().error).toBe('port_busy')
  })
})

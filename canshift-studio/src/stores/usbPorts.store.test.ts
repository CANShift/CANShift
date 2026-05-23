// usbPorts.store.test.ts — Behaviour contract for the USB serial-port
// discovery store (issue #1015, S-H-3).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PortInfo } from '../../shared/ipc-contract'

const listPortsMock = vi.fn<() => Promise<PortInfo[]>>()

vi.mock('../services/ipc.service', () => ({
  usbService: {
    listPorts: (): Promise<PortInfo[]> => listPortsMock(),
  },
}))

const setError = vi.fn()
const clearError = vi.fn()
vi.mock('./device.store', () => ({
  useDeviceStore: {
    getState: () => ({ setError, clearError }),
  },
}))

const logPush = vi.fn()
vi.mock('./log.store', () => ({
  useLogStore: {
    getState: () => ({ push: logPush }),
  },
}))

const errorPush = vi.fn()
vi.mock('./error.store', () => ({
  useErrorStore: {
    getState: () => ({ push: errorPush }),
  },
}))

import { useUsbPortsStore } from './usbPorts.store'

beforeEach(() => {
  listPortsMock.mockReset()
  setError.mockReset()
  clearError.mockReset()
  logPush.mockReset()
  errorPush.mockReset()
  useUsbPortsStore.setState({ ports: [], selectedPort: '', loading: false })
})

afterEach(() => {
  useUsbPortsStore.setState({ ports: [], selectedPort: '', loading: false })
})

describe('usbPorts.store', () => {
  it('starts empty with no selection', () => {
    const s = useUsbPortsStore.getState()
    expect(s.ports).toEqual([])
    expect(s.selectedPort).toBe('')
    expect(s.loading).toBe(false)
  })

  it('refresh() fills the port list and clears loading', async () => {
    const ports: PortInfo[] = [
      { path: '/dev/cu.usb1', manufacturer: 'Silicon Labs' },
      { path: '/dev/cu.usb2' },
    ]
    listPortsMock.mockResolvedValueOnce(ports)

    await useUsbPortsStore.getState().refresh()

    const s = useUsbPortsStore.getState()
    expect(s.ports).toHaveLength(2)
    expect(s.loading).toBe(false)
    // Multiple ports → no auto-selection.
    expect(s.selectedPort).toBe('')
    expect(clearError).toHaveBeenCalled()
  })

  it('auto-selects the only available port', async () => {
    listPortsMock.mockResolvedValueOnce([{ path: '/dev/cu.usb1' }])

    await useUsbPortsStore.getState().refresh()

    expect(useUsbPortsStore.getState().selectedPort).toBe('/dev/cu.usb1')
  })

  it('setSelectedPort overrides the current selection', () => {
    useUsbPortsStore.getState().setSelectedPort('/dev/cu.usb9')
    expect(useUsbPortsStore.getState().selectedPort).toBe('/dev/cu.usb9')
  })

  it('refresh() reports IPC failures via the error / log / device stores', async () => {
    listPortsMock.mockRejectedValueOnce(new Error('serial driver missing'))

    await useUsbPortsStore.getState().refresh()

    expect(useUsbPortsStore.getState().loading).toBe(false)
    expect(setError).toHaveBeenCalledWith('Failed to list serial ports')
    expect(logPush).toHaveBeenCalledWith('error', 'Failed to list serial ports')
    expect(errorPush).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'usb', code: 'PORT_LIST_FAILED' })
    )
  })

  it('refresh() drops concurrent calls while one is in flight', async () => {
    let resolveFn: (v: PortInfo[]) => void = () => undefined
    listPortsMock.mockReturnValueOnce(
      new Promise<PortInfo[]>((resolve) => {
        resolveFn = resolve
      })
    )

    const first = useUsbPortsStore.getState().refresh()
    const second = useUsbPortsStore.getState().refresh()
    expect(useUsbPortsStore.getState().loading).toBe(true)

    resolveFn([])
    await Promise.all([first, second])

    expect(listPortsMock).toHaveBeenCalledTimes(1)
  })
})

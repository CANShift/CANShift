import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useConnectionStore } from './connection.store'
import { useDeviceStore } from './device.store'

const installNavigatorSerial = (requestPort: () => Promise<SerialPort>): void => {
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      serial: {
        requestPort: vi.fn(requestPort),
        getPorts: vi.fn(async () => []),
      },
    },
    configurable: true,
  })
}

const makeFailingPort = (message: string): SerialPort =>
  ({
    open: vi.fn(async () => {
      throw new Error(message)
    }),
  }) as unknown as SerialPort

describe('connection.store lastError filtering (#1743)', () => {
  beforeEach(() => {
    useDeviceStore.getState().setDisconnected()
    useConnectionStore.setState({ lastError: null })
  })

  it('does not treat a cancelled port picker as an error', async () => {
    installNavigatorSerial(async () => {
      throw new Error('NotFoundError: No port selected by the user.')
    })
    await useConnectionStore.getState().connect()
    expect(useConnectionStore.getState().lastError).toBeNull()
    expect(useDeviceStore.getState().status).toBe('disconnected')
    expect(useDeviceStore.getState().errorMessage).toBeNull()
  })

  it('clears a previous error when the user cancels the picker', async () => {
    useConnectionStore.setState({ lastError: 'connection_closed' })
    installNavigatorSerial(async () => {
      throw new Error('NotFoundError: No port selected by the user.')
    })
    await useConnectionStore.getState().connect()
    expect(useConnectionStore.getState().lastError).toBeNull()
  })

  it('surfaces real open failures', async () => {
    installNavigatorSerial(async () => makeFailingPort('unused'))
    await useConnectionStore.getState().connect(makeFailingPort('Failed to open serial port.'))
    expect(useConnectionStore.getState().lastError).toMatch(/^Port busy/)
    expect(useDeviceStore.getState().status).toBe('error')
  })
})

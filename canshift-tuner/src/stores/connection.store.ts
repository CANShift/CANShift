import { create } from 'zustand'
import { getSerialClient, type SerialStatus } from '../transport/webserial-client'
import { useDeviceStore } from './device.store'

const USB_LABEL = 'webserial'

const NON_ERROR_CODES = new Set(['no_port_selected'])

const toReportableError = (error: string | null | undefined): string | null =>
  error !== undefined && error !== null && !NON_ERROR_CODES.has(error) ? error : null

interface ConnectionState {
  port: SerialPort | null
  status: SerialStatus
  lastError: string | null

  connect: (port?: SerialPort) => Promise<void>
  disconnect: () => void
  tryAutoReconnect: () => Promise<void>
}

export const useConnectionStore = create<ConnectionState>()((set, get) => {
  const client = getSerialClient()

  const unsubscribeStatus = client.onStatus((status, error) => {
    const reportable = toReportableError(error)
    set({ status, lastError: reportable })
    if (status === 'connected') {
      useDeviceStore.getState().setConnected(USB_LABEL)
    } else if (status === 'disconnected') {
      const device = useDeviceStore.getState()
      if (device.connected || reportable) {
        device.setDisconnected(reportable)
      }
    }
  })

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      unsubscribeStatus()
    })
  }

  return {
    port: client.getPort(),
    status: client.getStatus(),
    lastError: null,

    connect: async (port) => {
      try {
        await client.connect(port)
        set({ port: client.getPort() })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'connect_failed'
        set({ lastError: toReportableError(msg) })
      }
    },

    disconnect: () => {
      client.disconnect()
      set({ port: null })
    },

    tryAutoReconnect: async () => {
      if (typeof navigator === 'undefined' || !navigator.serial) return
      try {
        const ports = await navigator.serial.getPorts()
        const first = ports[0]
        if (!first) return
        await get().connect(first)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'auto_reconnect_failed'
        set({ lastError: msg })
      }
    },
  }
})

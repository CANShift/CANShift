// connection.store.ts — Owns the WebSerial port handle + live status for the
// canshift-tuner SPA.
//
// Mirrors `canshift-studio-web/src/stores/connection.store.ts` but adapted for
// WebSerial: no host/port literal — the underlying connection is a SerialPort
// handle the user grants via `navigator.serial.requestPort()`.

import { create } from 'zustand'
import { getSerialClient, type SerialStatus } from '../transport/webserial-client'
import { useDeviceStore } from './device.store'

const USB_LABEL = 'webserial'

interface ConnectionState {
  /** The granted SerialPort handle, or `null` when disconnected. */
  port: SerialPort | null
  status: SerialStatus
  /** Last connection error message (open failure, queue exhaustion, etc.). */
  lastError: string | null

  /**
   * Open a connection. If `port` is omitted, prompts the user via
   * `navigator.serial.requestPort()`. Resolves once the port is open.
   */
  connect: (port?: SerialPort) => Promise<void>
  /** Close the port and stop reconnecting. */
  disconnect: () => void
  /**
   * Reconnect to the first already-authorised port without a chooser prompt.
   * Used on app boot so a returning user picks up where they left off.
   */
  tryAutoReconnect: () => Promise<void>
}

export const useConnectionStore = create<ConnectionState>()((set, get) => {
  const client = getSerialClient()

  // Mirror the serial client's status into both this store and the device
  // store. The device store is what the editor surfaces read (`connected`
  // flag) — promote `connected` and `disconnected` transitions into it here.
  const unsubscribeStatus = client.onStatus((status, error) => {
    set({ status, lastError: error ?? null })
    if (status === 'connected') {
      useDeviceStore.getState().setConnected(USB_LABEL)
    } else if (status === 'disconnected') {
      const device = useDeviceStore.getState()
      if (device.connected || error) {
        useDeviceStore.setState({
          status: error ? 'error' : 'disconnected',
          portPath: null,
          transport: null,
          wifiHost: null,
          connected: false,
          syncing: false,
          isDayMode: null,
          firmwareCheck: { kind: 'idle' },
          firmwareCheckTick: 0,
          lastPushedConfig: null,
          errorMessage: error ?? null,
        })
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
      await client.connect(port)
      set({ port: client.getPort() })
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

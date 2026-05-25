// connection.store.ts — Owns the WebSocket connection target + live status
// for the dash-hosted Studio renderer (#1077 phase 3).
//
// The existing `device.store.ts` keeps tracking the "is the editor wired to a
// live device" boolean (so the editor surfaces stay transport-agnostic), but
// the host/port pair and the underlying `WsClient` state machine live here.
// Splitting them this way mirrors how the Electron Studio kept transport
// concerns (`wifi.service.ts`) out of the renderer state surface.

import { create } from 'zustand'
import { getWsClient, type WsStatus } from '../transport/ws-client'
import { useDeviceStore } from './device.store'

const DEFAULT_HOST = 'canshift.local'
const DEFAULT_PORT = 81
const HOST_STORAGE_KEY = 'canshift:last-host'
const PORT_STORAGE_KEY = 'canshift:last-port'

interface ConnectionState {
  host: string
  port: number
  status: WsStatus
  /** Last connection error message (refusal, timeout, etc.). */
  lastError: string | null

  setTarget: (host: string, port?: number) => void
  /** Open the WS to the configured target. Resolves on the first OPEN. */
  connect: (host?: string, port?: number) => Promise<void>
  /** Close the WS and stop reconnecting. */
  disconnect: () => void
}

function readStoredHost(): string {
  try {
    return localStorage.getItem(HOST_STORAGE_KEY) ?? DEFAULT_HOST
  } catch {
    return DEFAULT_HOST
  }
}

function readStoredPort(): number {
  try {
    const raw = localStorage.getItem(PORT_STORAGE_KEY)
    if (!raw) return DEFAULT_PORT
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PORT
  } catch {
    return DEFAULT_PORT
  }
}

function writeStored(host: string, port: number): void {
  try {
    localStorage.setItem(HOST_STORAGE_KEY, host)
    localStorage.setItem(PORT_STORAGE_KEY, String(port))
  } catch {
    // Privacy-mode browsers throw — fall back to in-memory state only.
  }
}

export const useConnectionStore = create<ConnectionState>()((set, get) => {
  const client = getWsClient()

  // Mirror the WS client's status into the store + the device store. The
  // device store is what the editor surfaces read (`connected` flag), so we
  // promote `connected` and `disconnected` transitions into it here.
  client.onStatus((status, error) => {
    set({ status, lastError: error ?? null })
    const device = useDeviceStore.getState()
    if (status === 'connected') {
      const host = get().host
      device.setConnectedWifi(host)
    } else if (status === 'disconnected') {
      if (device.connected) device.setDisconnected()
      if (error) device.setError(error)
    }
  })

  return {
    host: readStoredHost(),
    port: readStoredPort(),
    status: client.getStatus(),
    lastError: null,

    setTarget: (host, port) => {
      const nextPort = port ?? DEFAULT_PORT
      set({ host, port: nextPort })
      writeStored(host, nextPort)
    },

    connect: async (host, port) => {
      const targetHost = host ?? get().host
      const targetPort = port ?? get().port
      set({ host: targetHost, port: targetPort })
      writeStored(targetHost, targetPort)
      await client.connect(targetHost, targetPort)
    },

    disconnect: () => {
      client.disconnect()
    },
  }
})

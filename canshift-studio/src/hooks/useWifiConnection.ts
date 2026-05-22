// useWifiConnection.ts — Shared WiFi discover / connect / disconnect logic.
//
// Mirrors `useUsbConnection` for the WiFi transport (#1071). Like the USB
// hook, this one does NOT subscribe to unsolicited connection events — those
// land in `useUsbEvents`, mounted exactly once at the App root, which is the
// single source of truth for the device store's connection flags (#696).

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'
import { useErrorStore } from '../stores/error.store'
import { wifiService, type DiscoveredDevice } from '../services/ipc.service'

/** Default TCP port the dash listens on. Kept here so the UI can pre-fill it. */
export const DEFAULT_WIFI_PORT = 5050

export function useWifiConnection(): {
  devices: DiscoveredDevice[]
  discovering: boolean
  connecting: boolean
  connected: boolean
  discover: () => void
  connect: (host: string, port: number) => void
  disconnect: () => void
} {
  const [devices, setDevices] = useState<DiscoveredDevice[]>([])
  const [discovering, setDiscovering] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const connected = useDeviceStore((s) => s.connected)
  const setError = useDeviceStore((s) => s.setError)
  const clearError = useDeviceStore((s) => s.clearError)
  const setManualDisconnect = useDeviceStore((s) => s.setManualDisconnect)
  const log = useLogStore((s) => s.push)
  const pushError = useErrorStore((s) => s.push)

  const discover = useCallback(() => {
    setDiscovering(true)
    clearError()
    log('info', 'Scanning network for CANShift devices…')
    wifiService
      .discover()
      .then((list) => {
        setDevices(list)
        log('info', `Found ${String(list.length)} device${list.length !== 1 ? 's' : ''} via mDNS`)
      })
      .catch(() => {
        const msg = 'mDNS discovery failed'
        setError(msg)
        log('error', msg)
        pushError({ source: 'system', code: 'WIFI_DISCOVER_FAILED', message: msg })
      })
      .finally(() => {
        setDiscovering(false)
      })
  }, [clearError, setError, log, pushError])

  const connect = useCallback(
    (host: string, port: number) => {
      if (!host) return
      // Clear the manual-disconnect flag — explicit user intent overrides the
      // suppression latch (mirrors `useUsbConnection.connect`, issue #977).
      setManualDisconnect(false)
      setConnecting(true)
      clearError()
      log('info', `Connecting to ${host}:${String(port)} over WiFi…`)
      wifiService
        .connect(host, port)
        .then((result) => {
          if (result.success) {
            // Store update lands via WIFI_CONNECTION_CHANGED → useUsbEvents.
            log('success', `Connected to ${host}:${String(port)}`)
            toast.success(`Connected to ${host}`)
          } else {
            const msg = result.error ?? 'WiFi connection failed'
            setError(msg)
            log('error', msg)
            pushError({
              source: 'system',
              code: 'WIFI_CONNECT_FAILED',
              message: msg,
              detail: `${host}:${String(port)}`,
            })
          }
        })
        .catch(() => {
          const msg = 'WiFi connection error'
          setError(msg)
          log('error', `WiFi connection error to ${host}:${String(port)}`)
          pushError({
            source: 'system',
            code: 'WIFI_CONNECT_FAILED',
            message: msg,
            detail: `${host}:${String(port)}`,
          })
        })
        .finally(() => {
          setConnecting(false)
        })
    },
    [setError, clearError, setManualDisconnect, log, pushError]
  )

  const disconnect = useCallback(() => {
    setManualDisconnect(true)
    wifiService
      .disconnect()
      .then(() => {
        log('info', 'WiFi disconnected')
      })
      .catch(() => {
        log('warn', 'WiFi disconnect error — forcing disconnected state')
      })
  }, [log, setManualDisconnect])

  return {
    devices,
    discovering,
    connecting,
    connected,
    discover,
    connect,
    disconnect,
  }
}

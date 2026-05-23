// useUsbConnection.ts — Shared USB connect / disconnect / refresh logic.
//
// The port-discovery state (ports / selectedPort / loading) lives in
// `usbPorts.store.ts` since issue #1015 (S-H-3) — same pattern as
// `releases.store` / `appVersion.store` from #1067. This hook is now a thin
// selector + imperative bridge over the connect/disconnect side, which is
// user-driven action, not data-fetching, and stays in the hook.
//
// Unsolicited device events (unexpected disconnect, errors, device logs)
// live in `useUsbEvents` which is mounted ONCE at the App root. Mounting
// the listeners here would duplicate every device log line for each
// concurrently-mounted ConnectModal (#484).

import { useCallback } from 'react'
import { toast } from 'sonner'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'
import { useErrorStore } from '../stores/error.store'
import { useUsbPortsStore } from '../stores/usbPorts.store'
import { usbService } from '../services/ipc.service'

export function useUsbConnection() {
  const ports = useUsbPortsStore((s) => s.ports)
  const selectedPort = useUsbPortsStore((s) => s.selectedPort)
  const loading = useUsbPortsStore((s) => s.loading)
  const setSelectedPort = useUsbPortsStore((s) => s.setSelectedPort)
  const refreshPorts = useUsbPortsStore((s) => s.refresh)

  const connected = useDeviceStore((s) => s.connected)
  const setError = useDeviceStore((s) => s.setError)
  const clearError = useDeviceStore((s) => s.clearError)
  const setManualDisconnect = useDeviceStore((s) => s.setManualDisconnect)
  const log = useLogStore((s) => s.push)
  const pushError = useErrorStore((s) => s.push)

  const connect = useCallback(() => {
    if (!selectedPort) return
    // Clear the manual-disconnect flag — the user is explicitly opting back
    // into the connection, so let `useAutoConnect`'s polling resume after a
    // future drop. Issue #977.
    setManualDisconnect(false)
    clearError()
    log('info', `Connecting to ${selectedPort}…`)
    usbService
      .connect(selectedPort)
      .then((result) => {
        if (result.success) {
          // Store update happens via the USB_CONNECTION_CHANGED IPC event —
          // `useUsbEvents` is the single source of truth (#696).
          log('success', `Connected to ${selectedPort}`)
          toast.success(`Connected to ${selectedPort}`)
        } else {
          const msg = result.error ?? 'Connection failed'
          setError(msg)
          log('error', msg)
          pushError({ source: 'usb', code: 'CONNECT_FAILED', message: msg, detail: selectedPort })
        }
      })
      .catch(() => {
        const msg = 'Connection error'
        setError(msg)
        log('error', `Connection error on ${selectedPort}`)
        pushError({ source: 'usb', code: 'CONNECT_FAILED', message: msg, detail: selectedPort })
      })
  }, [selectedPort, setError, clearError, setManualDisconnect, log, pushError])

  const disconnect = useCallback(() => {
    // Latch the manual-disconnect flag BEFORE the IPC call so that the
    // moment `USB_CONNECTION_CHANGED` drops the connection,
    // `useAutoConnect` already sees the suppression flag and skips its
    // 2 s reconnect poll. Without this the user would observe a brief
    // disconnect → auto-reconnect bounce. Issue #977.
    setManualDisconnect(true)
    // Store update happens via the USB_CONNECTION_CHANGED IPC event —
    // `useUsbEvents` is the single source of truth (#696).
    usbService
      .disconnect()
      .then(() => {
        log('info', 'Disconnected')
      })
      .catch(() => {
        log('warn', 'Disconnect error — forcing disconnected state')
      })
  }, [log, setManualDisconnect])

  return {
    ports,
    selectedPort,
    setSelectedPort,
    loading,
    connected,
    refreshPorts,
    connect,
    disconnect,
  }
}

// useUsbConnection.ts — Shared USB connect / disconnect / refresh logic.
//
// Unsolicited device events (unexpected disconnect, errors, device logs)
// live in `useUsbEvents` which is mounted ONCE at the App root. Mounting
// the listeners here would duplicate every device log line for each
// concurrently-mounted ConnectModal (#484).

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'
import { useErrorStore } from '../stores/error.store'
import type { PortInfo } from '../../shared/ipc-contract'
import { usbService } from '../services/ipc.service'

export function useUsbConnection() {
  const [ports, setPorts] = useState<PortInfo[]>([])
  const [selectedPort, setSelectedPort] = useState('')
  const [loading, setLoading] = useState(false)

  const connected = useDeviceStore((s) => s.connected)
  const setError = useDeviceStore((s) => s.setError)
  const clearError = useDeviceStore((s) => s.clearError)
  const setManualDisconnect = useDeviceStore((s) => s.setManualDisconnect)
  const log = useLogStore((s) => s.push)
  const pushError = useErrorStore((s) => s.push)

  const refreshPorts = useCallback(() => {
    setLoading(true)
    clearError()
    usbService
      .listPorts()
      .then((list) => {
        setPorts(list)
        if (list.length === 1 && list[0]) setSelectedPort(list[0].path)
        else setSelectedPort('')
        log('info', `Found ${String(list.length)} port${list.length !== 1 ? 's' : ''}`)
      })
      .catch(() => {
        const msg = 'Failed to list serial ports'
        setError(msg)
        log('error', msg)
        pushError({ source: 'usb', code: 'PORT_LIST_FAILED', message: msg })
      })
      .finally(() => {
        setLoading(false)
      })
  }, [clearError, setError, log, pushError])

  const connect = useCallback(() => {
    if (!selectedPort) return
    // Clear the manual-disconnect flag — the user is explicitly opting back
    // into the connection, so let `useAutoConnect`'s polling resume after a
    // future drop. Issue #977.
    setManualDisconnect(false)
    setLoading(true)
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
      .finally(() => {
        setLoading(false)
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

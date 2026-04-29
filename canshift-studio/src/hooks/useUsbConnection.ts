// useUsbConnection.ts — Shared USB connect / disconnect / refresh logic.
// Also listens for unsolicited device events (unexpected disconnect, errors).

import { useState, useCallback, useEffect } from 'react'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'
import { usbService } from '../services/ipc.service'
import { IpcChannels } from '../../main/ipc/ipc-channels'
import type { PortInfo } from '../services/ipc.service'

interface ConnectionChangedPayload {
  connected: boolean
  portPath?: string
}

export function useUsbConnection() {
  const [ports, setPorts] = useState<PortInfo[]>([])
  const [selectedPort, setSelectedPort] = useState('')
  const [loading, setLoading] = useState(false)

  const connected = useDeviceStore((s) => s.connected)
  const setConnected = useDeviceStore((s) => s.setConnected)
  const setDisconnected = useDeviceStore((s) => s.setDisconnected)
  const setError = useDeviceStore((s) => s.setError)
  const clearError = useDeviceStore((s) => s.clearError)
  const log = useLogStore((s) => s.push)

  // Listen for unsolicited device events (cable pulled, device reset, errors)
  useEffect(() => {
    const handleConnectionChanged = (payload: unknown) => {
      const status = payload as ConnectionChangedPayload
      if (!status.connected) {
        setDisconnected()
        log('warn', 'Device disconnected unexpectedly')
      }
    }

    const handleError = (message: unknown) => {
      const msg = typeof message === 'string' ? message : 'USB error'
      setError(msg)
      log('error', `USB: ${msg}`)
    }

    window.ipc.on(IpcChannels.USB_CONNECTION_CHANGED, handleConnectionChanged)
    window.ipc.on(IpcChannels.USB_ERROR, handleError)

    return () => {
      window.ipc.off(IpcChannels.USB_CONNECTION_CHANGED, handleConnectionChanged)
      window.ipc.off(IpcChannels.USB_ERROR, handleError)
    }
  }, [setDisconnected, setError, log])

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
        setError('Failed to list serial ports')
        log('error', 'Failed to list serial ports')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [clearError, setError, log])

  const connect = useCallback(() => {
    if (!selectedPort) return
    setLoading(true)
    clearError()
    log('info', `Connecting to ${selectedPort}…`)
    usbService
      .connect(selectedPort)
      .then((result) => {
        if (result.success) {
          setConnected(selectedPort)
          log('success', `Connected to ${selectedPort}`)
        } else {
          const msg = result.error ?? 'Connection failed'
          setError(msg)
          log('error', msg)
        }
      })
      .catch(() => {
        setError('Connection error')
        log('error', `Connection error on ${selectedPort}`)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [selectedPort, setConnected, setError, clearError, log])

  const disconnect = useCallback(() => {
    usbService
      .disconnect()
      .then(() => {
        setDisconnected()
        log('info', 'Disconnected')
      })
      .catch(() => {
        setDisconnected()
        log('warn', 'Disconnect error — forcing disconnected state')
      })
  }, [setDisconnected, log])

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

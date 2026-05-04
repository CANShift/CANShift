// useUsbConnection.ts — Shared USB connect / disconnect / refresh logic.
// Also listens for unsolicited device events (unexpected disconnect, errors).

import { useState, useCallback, useEffect, useRef } from 'react'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'
import { useCanHealthStore } from '../stores/canHealth.store'
import { useErrorStore } from '../stores/error.store'
import { usbService } from '../services/ipc.service'
import { IpcChannels } from '../../main/ipc/ipc-channels'
import type { PortInfo, CanHealth } from '../services/ipc.service'
import type { LogLevel } from '../stores/log.store'

interface ConnectionChangedPayload {
  connected: boolean
  portPath?: string
}

interface AppLogPayload {
  level: LogLevel
  message: string
  ts: number
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
  const updateCanHealth = useCanHealthStore((s) => s.update)
  const pushError = useErrorStore((s) => s.push)
  const pushOrUpdateError = useErrorStore((s) => s.pushOrUpdate)

  // Track last seen CAN error count to detect increases (firmware reports cumulative total)
  const prevCanErrors = useRef<number | null>(null)

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
      pushOrUpdateError({ source: 'usb', code: 'USB_ERROR', message: msg })
    }

    const handleCanHealth = (payload: unknown) => {
      const h = payload as CanHealth
      updateCanHealth(h.fps, h.errors)

      // Only surface CAN errors when the cumulative count increases
      if (h.errors > 0) {
        const prev = prevCanErrors.current
        if (prev === null || h.errors > prev) {
          const delta = prev !== null ? h.errors - prev : h.errors
          pushOrUpdateError({
            source: 'can',
            code: 'CAN_BUS_ERRORS',
            message: `CAN bus: ${String(h.errors)} error${h.errors !== 1 ? 's' : ''} cumulative`,
            detail: `+${String(delta)} new · ${h.fps.toFixed(1)} frames/s`,
          })
        }
      }
      prevCanErrors.current = h.errors
    }

    // Forward structured log messages from the main process to the console panel
    const handleAppLog = (payload: unknown) => {
      if (
        typeof payload !== 'object' ||
        payload === null ||
        !('message' in payload) ||
        !('level' in payload)
      ) {
        return
      }
      const entry = payload as AppLogPayload
      log(entry.level, `[main] ${entry.message}`)
      if (entry.level === 'error') {
        pushError({ source: 'system', code: 'MAIN_ERROR', message: entry.message })
      }
    }

    window.ipc.on(IpcChannels.USB_CONNECTION_CHANGED, handleConnectionChanged)
    window.ipc.on(IpcChannels.USB_ERROR, handleError)
    window.ipc.on(IpcChannels.CAN_HEALTH_UPDATE, handleCanHealth)
    window.ipc.on(IpcChannels.APP_LOG, handleAppLog)

    return () => {
      window.ipc.off(IpcChannels.USB_CONNECTION_CHANGED, handleConnectionChanged)
      window.ipc.off(IpcChannels.USB_ERROR, handleError)
      window.ipc.off(IpcChannels.CAN_HEALTH_UPDATE, handleCanHealth)
      window.ipc.off(IpcChannels.APP_LOG, handleAppLog)
    }
  }, [setDisconnected, setError, log, updateCanHealth, pushError, pushOrUpdateError])

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
  }, [selectedPort, setConnected, setError, clearError, log, pushError])

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

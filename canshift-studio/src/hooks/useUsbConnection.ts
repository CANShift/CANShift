// useUsbConnection.ts — Shared USB connect / disconnect / refresh logic

import { useState, useCallback } from 'react'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'
import { usbService } from '../services/ipc.service'
import type { PortInfo } from '../services/ipc.service'

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

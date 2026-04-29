// useUsbConnection.ts — Shared USB connect / disconnect / refresh logic

import { useState, useCallback } from 'react'
import { useDeviceStore } from '../stores/device.store'
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

  const refreshPorts = useCallback(() => {
    setLoading(true)
    clearError()
    usbService
      .listPorts()
      .then((list) => {
        setPorts(list)
        if (list.length === 1 && list[0]) setSelectedPort(list[0].path)
        else setSelectedPort('')
      })
      .catch(() => {
        setError('Failed to list serial ports')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [clearError, setError])

  const connect = useCallback(() => {
    if (!selectedPort) return
    setLoading(true)
    clearError()
    usbService
      .connect(selectedPort)
      .then((result) => {
        if (result.success) {
          setConnected(selectedPort)
        } else {
          setError(result.error ?? 'Connection failed')
        }
      })
      .catch(() => {
        setError('Connection error')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [selectedPort, setConnected, setError, clearError])

  const disconnect = useCallback(() => {
    usbService
      .disconnect()
      .then(() => {
        setDisconnected()
      })
      .catch(() => {
        setDisconnected()
      })
  }, [setDisconnected])

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

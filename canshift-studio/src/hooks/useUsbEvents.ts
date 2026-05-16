// useUsbEvents.ts — Single registration point for unsolicited device events.
//
// Must be mounted exactly once at the App root. Previously the same listeners
// lived inside `useUsbConnection`, which is called from multiple components
// (TopBar's ConnectModal, ConnectScreen's ConnectModal, WelcomeModal's
// ConnectModal). When two of those modal hosts mounted concurrently — which
// happens around a flash session, since `ConnectScreen` is visible while the
// device is rebooting AND TopBar can have its own modal open — every device
// log line was pushed into `useLogStore` once per active hook instance,
// producing duplicate entries (#484).
//
// Splitting the unsolicited-event listeners off into this hook keeps a single
// subscription regardless of how many connect surfaces are visible.

import { useEffect, useRef } from 'react'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'
import { useCanHealthStore } from '../stores/canHealth.store'
import { useErrorStore } from '../stores/error.store'
import { IpcChannels } from '../../shared/ipc-channels'
import type { CanHealth } from '../services/ipc.service'
import { isDeviceLogPayload } from '../services/ipc.service'
import type { LogLevel } from '../stores/log.store'

interface ConnectionChangedPayload {
  connected: boolean
  portPath: string | null
  intentional: boolean
}

interface AppLogPayload {
  level: LogLevel
  message: string
  ts: number
}

// Map a firmware log level letter to the renderer's LogLevel.
// Debug/verbose collapse to 'info' because the renderer's log panel does not
// have a debug rung — keeping all messages visible is preferable to dropping.
function mapDeviceLevel(level: string): LogLevel {
  switch (level) {
    case 'E':
      return 'error'
    case 'W':
      return 'warn'
    case 'I':
    case 'D':
    case 'V':
    default:
      return 'info'
  }
}

function isConnectionChangedPayload(v: unknown): v is ConnectionChangedPayload {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return typeof o.connected === 'boolean' && typeof o.intentional === 'boolean'
}

function isAppLogPayload(v: unknown): v is AppLogPayload {
  return typeof v === 'object' && v !== null && 'message' in v && 'level' in v
}

function isCanHealth(v: unknown): v is CanHealth {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { fps?: unknown }).fps === 'number' &&
    typeof (v as { errors?: unknown }).errors === 'number'
  )
}

/**
 * Mounts the global USB event listeners. Must be called exactly once from
 * `App.tsx`. Idempotent at the IPC level — re-mounts during dev (StrictMode)
 * unsubscribe cleanly, but the global guarantee is structural: don't add a
 * second call from another component.
 */
export function useUsbEvents(): void {
  const setConnected = useDeviceStore((s) => s.setConnected)
  const setDisconnected = useDeviceStore((s) => s.setDisconnected)
  const setError = useDeviceStore((s) => s.setError)
  const log = useLogStore((s) => s.push)
  const updateCanHealth = useCanHealthStore((s) => s.update)
  const pushError = useErrorStore((s) => s.push)
  const pushOrUpdateError = useErrorStore((s) => s.pushOrUpdate)

  // Cumulative CAN error count from the device — used to compute deltas so
  // we only surface NEW errors instead of repeating the running total.
  const prevCanErrors = useRef<number | null>(null)

  useEffect(() => {
    // Single source of truth for the device-store connection flags (#696).
    // Every connect / disconnect edge from the main process lands here —
    // call sites must NOT call setConnected / setDisconnected directly after
    // a usbService.connect / disconnect, the IPC round-trip already does it.
    const handleConnectionChanged = (payload: unknown): void => {
      if (!isConnectionChangedPayload(payload)) return
      if (payload.connected) {
        if (payload.portPath !== null) setConnected(payload.portPath)
      } else {
        setDisconnected()
        if (!payload.intentional) log('warn', 'Device disconnected unexpectedly')
      }
    }

    const handleError = (message: unknown): void => {
      const msg = typeof message === 'string' ? message : 'USB error'
      setError(msg)
      log('error', `USB: ${msg}`)
      pushOrUpdateError({ source: 'usb', code: 'USB_ERROR', message: msg })
    }

    const handleCanHealth = (payload: unknown): void => {
      if (!isCanHealth(payload)) return
      updateCanHealth(payload.fps, payload.errors)

      // Only surface CAN errors when the cumulative count increases
      if (payload.errors > 0) {
        const prev = prevCanErrors.current
        if (prev === null || payload.errors > prev) {
          const delta = prev !== null ? payload.errors - prev : payload.errors
          pushOrUpdateError({
            source: 'can',
            code: 'CAN_BUS_ERRORS',
            message: `CAN bus: ${String(payload.errors)} error${payload.errors !== 1 ? 's' : ''} cumulative`,
            detail: `+${String(delta)} new · ${payload.fps.toFixed(1)} frames/s`,
          })
        }
      }
      prevCanErrors.current = payload.errors
    }

    const handleAppLog = (payload: unknown): void => {
      if (!isAppLogPayload(payload)) return
      log(payload.level, `[main] ${payload.message}`)
      if (payload.level === 'error') {
        pushError({ source: 'system', code: 'MAIN_ERROR', message: payload.message })
      }
    }

    const handleDeviceLog = (payload: unknown): void => {
      if (!isDeviceLogPayload(payload)) return
      const mapped = mapDeviceLevel(payload.level)
      const formatted = `[device][${payload.tag}] ${payload.message}`
      log(mapped, formatted)
      if (mapped === 'error') {
        pushError({ source: 'usb', code: 'DEVICE_ERROR', message: formatted })
      }
    }

    window.ipc.on(IpcChannels.USB_CONNECTION_CHANGED, handleConnectionChanged)
    window.ipc.on(IpcChannels.USB_ERROR, handleError)
    window.ipc.on(IpcChannels.CAN_HEALTH_UPDATE, handleCanHealth)
    window.ipc.on(IpcChannels.APP_LOG, handleAppLog)
    window.ipc.on(IpcChannels.USB_DEVICE_LOG, handleDeviceLog)

    return () => {
      window.ipc.off(IpcChannels.USB_CONNECTION_CHANGED, handleConnectionChanged)
      window.ipc.off(IpcChannels.USB_ERROR, handleError)
      window.ipc.off(IpcChannels.CAN_HEALTH_UPDATE, handleCanHealth)
      window.ipc.off(IpcChannels.APP_LOG, handleAppLog)
      window.ipc.off(IpcChannels.USB_DEVICE_LOG, handleDeviceLog)
    }
  }, [setConnected, setDisconnected, setError, log, updateCanHealth, pushError, pushOrUpdateError])
}

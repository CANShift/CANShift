import { useEffect } from 'react'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'
import type { LogLevel } from '../stores/log.store'
import { deviceEvents } from '../transport'

const FIRMWARE_LEVEL_MAP: Record<string, LogLevel> = {
  E: 'error',
  W: 'warn',
  I: 'info',
  D: 'debug',
  V: 'debug',
}

export const useFirmwareLogBridge = (): void => {
  const connected = useDeviceStore((s) => s.connected)
  const transport = useDeviceStore((s) => s.transport)
  const simulationMode = useDeviceStore((s) => s.simulationMode)

  useEffect(() => {
    if (!connected || simulationMode || transport !== 'usb') return
    const push = useLogStore.getState().push
    const unsubscribe = deviceEvents.onLogLine(({ level, tag, message }) => {
      const mapped = FIRMWARE_LEVEL_MAP[level] ?? 'info'
      push(mapped, message, tag)
    })
    return unsubscribe
  }, [connected, simulationMode, transport])
}

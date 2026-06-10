import { useCallback, useState } from 'react'
import { useDashboardStore } from '../stores/dashboard.store'
import { useDeviceStore } from '../stores/device.store'
import { useConnectionStore } from '../stores/connection.store'
import { useLogStore } from '../stores/log.store'
import { usbService } from '../transport'

interface UseBurnDashboard {
  canBurn: boolean
  isBurning: boolean
  burn: () => Promise<void>
}

export const useBurnDashboard = (): UseBurnDashboard => {
  const config = useDashboardStore((s) => s.config)
  const isDirty = useDashboardStore((s) => s.isDirty)
  const markPushed = useDashboardStore((s) => s.markPushed)
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const firmwareCompat = useDeviceStore((s) => s.firmwareCompat)
  const connectionStatus = useConnectionStore((s) => s.status)
  const log = useLogStore((s) => s.push)

  const [isBurning, setIsBurning] = useState(false)

  const canBurn =
    !isBurning &&
    connected &&
    !simulationMode &&
    connectionStatus === 'connected' &&
    isDirty &&
    config !== null &&
    firmwareCompat.kind !== 'mismatch'

  const burn = useCallback(async () => {
    if (!canBurn || !config) return
    setIsBurning(true)
    try {
      const result = await usbService.pushConfig(config)
      if (result.success) {
        markPushed()
        log('success', 'Dashboard burned to device')
      } else {
        log('error', `Burn failed: ${result.error ?? 'unknown_error'}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log('error', `Burn failed: ${message}`)
    } finally {
      setIsBurning(false)
    }
  }, [canBurn, config, markPushed, log])

  return { canBurn, isBurning, burn }
}

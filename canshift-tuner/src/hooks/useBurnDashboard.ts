import { useCallback, useState } from 'react'
import { useDashboardStore } from '../stores/dashboard.store'
import { useDeviceStore } from '../stores/device.store'
import { useConnectionStore } from '../stores/connection.store'
import { useLogStore } from '../stores/log.store'
import { usbService } from '../transport'
import { verifyBurnedConfig } from './verifyBurnedConfig'

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
      if (!result.success) {
        log('error', `Burn failed: ${result.error ?? 'unknown_error'}`)
        return
      }
      log('info', 'Burn acked — verifying after reboot…')
      const verify = await verifyBurnedConfig(config)
      switch (verify.kind) {
        case 'ok':
          markPushed()
          log('success', 'Dashboard burned + verified on device')
          break
        case 'no_reboot':
          log(
            'error',
            'Burn verify failed: device did not come back after reboot — try unplug/replug'
          )
          break
        case 'fetch_failed':
          log('error', `Burn verify failed: could not read back config (${verify.error})`)
          break
        case 'mismatch':
          log('error', 'Burn verify failed: device persisted a different config — retry the burn')
          break
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

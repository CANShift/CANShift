// useBurnDashboard.ts — Push the editor dashboard config to the connected
// device. Shared by the Header's Burn button and the Cmd/Ctrl+S accelerator
// so the gating + side effects (mark-pushed, log) live in one place.

import { useCallback, useState } from 'react'
import { useDashboardStore } from '../stores/dashboard.store'
import { useDeviceStore } from '../stores/device.store'
import { useConnectionStore } from '../stores/connection.store'
import { useLogStore } from '../stores/log.store'
import { usbService } from '../transport'

interface UseBurnDashboard {
  /** True when a real device is connected (not simulation) and the editor has unsaved changes. */
  canBurn: boolean
  /** True while a push is in flight. */
  isBurning: boolean
  /** Trigger the push. No-op when `canBurn` is false. */
  burn: () => Promise<void>
}

export function useBurnDashboard(): UseBurnDashboard {
  const config = useDashboardStore((s) => s.config)
  const isDirty = useDashboardStore((s) => s.isDirty)
  const markPushed = useDashboardStore((s) => s.markPushed)
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const connectionStatus = useConnectionStore((s) => s.status)
  const log = useLogStore((s) => s.push)

  const [isBurning, setIsBurning] = useState(false)

  // Live link + something to write. Simulation mode is excluded — the demo
  // config isn't something the user wants pushed to a real device by reflex.
  const canBurn =
    !isBurning &&
    connected &&
    !simulationMode &&
    connectionStatus === 'connected' &&
    isDirty &&
    config !== null

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

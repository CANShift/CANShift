import { useCallback } from 'react'
import { useDashboardStore } from '../stores/dashboard.store'
import { useDeviceStore } from '../stores/device.store'
import { useConnectionStore } from '../stores/connection.store'
import { useLogStore } from '../stores/log.store'
import { useUiStore } from '../stores/ui.store'
import { unboundWidgetCount } from '../utils/unbound-widgets'
import { usbService } from '../transport'
import { humanizeTransportError } from '../transport/humanize-transport-error'
import { verifyBurnedConfig, type VerifyResult } from './verifyBurnedConfig'

interface UseBurnDashboard {
  canBurn: boolean
  isBurning: boolean
  burn: () => Promise<void>
  requestBurn: () => void
}

const verifyFailureMessage = (verify: Exclude<VerifyResult, { kind: 'ok' }>): string => {
  switch (verify.kind) {
    case 'no_reboot':
      return 'Device did not come back after reboot — try unplug/replug'
    case 'fetch_failed':
      return `Could not read back config (${humanizeTransportError(verify.error)})`
    case 'mismatch':
      return 'Device persisted a different config — retry the burn'
  }
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

  const burnPhase = useDeviceStore((s) => s.burnPhase)
  const setBurnPhase = useDeviceStore((s) => s.setBurnPhase)
  const setLastBurnResult = useDeviceStore((s) => s.setLastBurnResult)
  const isBurning = burnPhase !== 'idle'

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
    if (useDeviceStore.getState().burnPhase !== 'idle') return
    setBurnPhase('pushing')
    setLastBurnResult(null)
    try {
      const result = await usbService.pushConfig(config)
      if (!result.success) {
        const code = result.error ?? 'unknown_error'
        log('error', `Burn failed: ${code}`)
        setLastBurnResult({ kind: 'error', message: humanizeTransportError(code) })
        return
      }
      setBurnPhase('rebooting')
      log('info', 'Burn acked — verifying after reboot…')
      const verify = await verifyBurnedConfig(config)
      if (verify.kind === 'ok') {
        markPushed()
        log('success', 'Dashboard burned + verified on device')
        setLastBurnResult({ kind: 'success' })
      } else {
        const message = verifyFailureMessage(verify)
        log('error', `Burn verify failed: ${message}`)
        setLastBurnResult({ kind: 'error', message })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log('error', `Burn failed: ${message}`)
      setLastBurnResult({ kind: 'error', message: humanizeTransportError(message) })
    } finally {
      setBurnPhase('idle')
    }
  }, [canBurn, config, markPushed, log, setBurnPhase, setLastBurnResult])

  const requestBurn = useCallback(() => {
    if (!canBurn) return
    const unbound = unboundWidgetCount(useDashboardStore.getState().config)
    if (unbound > 0) {
      useUiStore.getState().requestUnboundBurnConfirm(unbound)
      return
    }
    void burn()
  }, [canBurn, burn])

  return { canBurn, isBurning, burn, requestBurn }
}

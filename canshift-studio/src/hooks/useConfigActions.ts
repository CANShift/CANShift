// useConfigActions.ts — Config open / save / burn operations shared across toolbar and menu

import { useCallback } from 'react'
import { toast } from 'sonner'
import type { DashboardConfig } from '@tmbk/canshift-core'
import { validateDashboard, migrateConfig, CURRENT_SCHEMA_VERSION } from '@tmbk/canshift-core'
import { useDashboardStore } from '../stores/dashboard.store'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'
import { useErrorStore } from '../stores/error.store'
import { usePushDiffStore } from '../stores/pushDiff.store'
import { useBurnFailureStore } from '../stores/burnFailure.store'
import { configService, usbService } from '../services/ipc.service'

// Burn timeouts usually mean the firmware isn't actively servicing the USB
// command loop — most often because a previous flash attempt left the device
// without a working firmware image. Surface that diagnosis instead of letting
// the user stare at a generic "Device did not acknowledge" toast (#372).
function burnErrorHint(rawError: string, firmwareVersion: string | null): string | null {
  const looksLikeTimeout = /timeout|did not acknowledge|no ack|no response/i.test(rawError)
  if (!looksLikeTimeout) return null
  if (firmwareVersion !== null) {
    return `Last known firmware version was ${firmwareVersion}. Device may have rebooted or stalled — try reconnecting.`
  }
  return 'Firmware may not be running — try flashing the firmware first.'
}

// Map a raw burn error to an ordered list of remediation steps surfaced in
// the blocking failure modal (#376). Falls back to a generic prompt when
// the error doesn't match a known code.
function burnRemediationHints(rawError: string): string[] {
  const lower = rawError.toLowerCase()
  if (lower.includes('not connected')) {
    return [
      'Connect the device via USB before burning.',
      'If you are in simulation mode, exit it first.',
    ]
  }
  if (/timeout|did not acknowledge|no ack|no response/.test(lower)) {
    return [
      'Check that the firmware is running (no boot loop).',
      'Make sure the USB cable is data-capable, not power-only.',
      'Try unplugging and replugging the device, then reconnect.',
      'If the issue persists, flash the firmware again from the Update screen.',
    ]
  }
  return [
    'Open the activity log for details.',
    'If the issue persists, capture the log and file a bug.',
  ]
}

export function useConfigActions() {
  const config = useDashboardStore((s) => s.config)
  const setConfig = useDashboardStore((s) => s.setConfig)
  const loadImported = useDashboardStore((s) => s.loadImported)
  const markSaved = useDashboardStore((s) => s.markSaved)

  const connected = useDeviceStore((s) => s.connected)
  const syncing = useDeviceStore((s) => s.syncing)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const setSyncing = useDeviceStore((s) => s.setSyncing)
  const setSyncComplete = useDeviceStore((s) => s.setSyncComplete)
  const setError = useDeviceStore((s) => s.setError)
  const lastPushedConfig = useDeviceStore((s) => s.lastPushedConfig)
  const setLastPushedConfig = useDeviceStore((s) => s.setLastPushedConfig)
  const setBurnPhase = useDeviceStore((s) => s.setBurnPhase)
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion)
  const canBurn = connected && !syncing && !simulationMode

  const showDiff = usePushDiffStore((s) => s.show)
  const showBurnFailure = useBurnFailureStore((s) => s.show)
  const dismissBurnFailure = useBurnFailureStore((s) => s.dismiss)

  const log = useLogStore((s) => s.push)
  const pushError = useErrorStore((s) => s.push)

  const applyOpenResult = useCallback(
    (result: Awaited<ReturnType<typeof configService.open>>) => {
      if (result.success && result.content) {
        let config = result.content as DashboardConfig
        try {
          const { config: migrated, applied } = migrateConfig(config, CURRENT_SCHEMA_VERSION)
          config = migrated as unknown as DashboardConfig
          if (applied.length > 0) {
            log('info', `Config migrated: ${applied.join(', ')}`)
          }
        } catch (err) {
          // Refuse to load a config we cannot bring up to the current schema —
          // letting it through risks silently mis-rendering or pushing a
          // stale shape to firmware. Surface the failure and bail out (#157).
          const msg = err instanceof Error ? err.message : String(err)
          log('error', `Migration failed for ${result.filePath ?? 'config'}: ${msg}`)
          pushError({
            source: 'config',
            code: 'MIGRATION_FAILED',
            message: `Cannot open ${result.filePath ?? 'config'} — migration failed: ${msg}`,
          })
          return
        }
        // Validate the migrated config before accepting it: File→Open used to
        // load any JSON the user picked, which then risked being pushed to
        // firmware as a corrupt shape (#693). Import already does this; we
        // mirror that guard on the open / openPath / session-restore paths.
        const validation = validateDashboard(config)
        if (!validation.valid) {
          validation.errors.forEach((e) => {
            log('error', `Open validation: ${e}`)
          })
          pushError({
            source: 'config',
            code: 'VALIDATION_FAILED',
            message: `${result.filePath ?? 'config'} has ${String(validation.errors.length)} validation error(s)`,
            detail: validation.errors.join('\n'),
          })
          return
        }
        validation.warnings.forEach((w) => {
          log('warn', `Open: ${w}`)
        })
        setConfig(config, result.filePath)
        log('info', `Opened ${result.filePath ?? 'config'}`)
      } else if (!result.success && result.error) {
        log('error', `Open failed: ${result.error}`)
        pushError({ source: 'config', code: 'OPEN_FAILED', message: result.error })
      }
    },
    [setConfig, log, pushError]
  )

  const openConfig = useCallback(() => {
    void configService.open().then(applyOpenResult)
  }, [applyOpenResult])

  const openConfigPath = useCallback(
    (filePath: string) => {
      void configService.openPath(filePath).then(applyOpenResult)
    },
    [applyOpenResult]
  )

  const importConfig = useCallback(() => {
    void configService.import().then((result) => {
      if (!result.success) {
        if (result.error) {
          log('error', `Import failed: ${result.error}`)
          pushError({ source: 'config', code: 'IMPORT_FAILED', message: result.error })
        }
        return
      }
      if (!result.content) return

      let imported = result.content as DashboardConfig
      try {
        const { config: migrated, applied } = migrateConfig(imported, CURRENT_SCHEMA_VERSION)
        imported = migrated as unknown as DashboardConfig
        if (applied.length > 0) {
          log('info', `Imported config migrated: ${applied.join(', ')}`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        log('error', `Import migration failed: ${msg}`)
        pushError({ source: 'config', code: 'MIGRATION_FAILED', message: msg })
        return
      }

      const validation = validateDashboard(imported)
      if (!validation.valid) {
        validation.errors.forEach((e) => {
          log('error', `Import validation: ${e}`)
        })
        pushError({
          source: 'config',
          code: 'VALIDATION_FAILED',
          message: `Imported config has ${String(validation.errors.length)} validation error(s)`,
          detail: validation.errors.join('\n'),
        })
        return
      }
      validation.warnings.forEach((w) => {
        log('warn', `Import: ${w}`)
      })

      loadImported(imported)
      log(
        'success',
        `Imported ${result.filePath ?? 'dashboard'} — review then Save to keep a local copy`
      )
    })
  }, [loadImported, log, pushError])

  const exportConfig = useCallback(() => {
    if (!config) return
    void configService.export(config).then((result) => {
      if (result.success && result.filePath) {
        log('success', `Exported snapshot to ${result.filePath}`)
      } else if (!result.success && result.error) {
        log('error', `Export failed: ${result.error}`)
        pushError({ source: 'config', code: 'EXPORT_FAILED', message: result.error })
      }
    })
  }, [config, log, pushError])

  const saveConfig = useCallback(() => {
    if (!config) return
    void configService.save(config).then((result) => {
      if (result.success && result.filePath) {
        markSaved(result.filePath)
        log('success', `Saved to ${result.filePath}`)
        toast.success('Config saved')
      } else if (!result.success && result.error) {
        log('error', `Save failed: ${result.error}`)
        pushError({ source: 'config', code: 'SAVE_FAILED', message: result.error })
      }
    })
  }, [config, markSaved, log, pushError])

  const burnConfig = useCallback(() => {
    if (!config || !connected || syncing) return

    // Simulation mode keeps `connected: true` for UI affordances but the main
    // process has no real serial port — pushing would fail with a confusing
    // "Not connected to device" from the IPC layer. Fail fast with a clear
    // message instead (#372).
    if (simulationMode) {
      const msg = 'Cannot burn while in simulation mode — exit simulation first.'
      log('error', `[burn] aborted — ${msg}`)
      pushError({ source: 'system', code: 'SIMULATION_MODE', message: msg })
      return
    }

    // Validate before pushing — refuse to burn an invalid config
    const validation = validateDashboard(config)
    if (!validation.valid) {
      validation.errors.forEach((err) => {
        log('error', `[burn] validation: ${err}`)
      })
      const summary = `[burn] aborted — ${String(validation.errors.length)} validation error(s)`
      log('error', summary)
      pushError({
        source: 'config',
        code: 'VALIDATION_FAILED',
        message: summary,
        detail: validation.errors.join('\n'),
      })
      return
    }

    // Surface warnings even when valid
    validation.warnings.forEach((w) => {
      log('warn', `[burn] validation: ${w}`)
    })

    // Payload size — what the firmware will actually receive over the wire.
    // Use the same JSON.stringify the IPC layer applies so the count matches.
    const payloadBytes = new TextEncoder().encode(JSON.stringify(config)).length
    const payloadKb = (payloadBytes / 1024).toFixed(1)

    const doBurn = (): void => {
      setSyncing(true)
      setBurnPhase('pushing')
      log(
        'info',
        `[burn] started — schema v${config.version}, ${payloadKb} KB (${String(payloadBytes)} bytes)`
      )
      const startedAt = performance.now()

      const handleFailure = (msg: string, elapsedMs: number): void => {
        setError(msg)
        setSyncing(false)
        setBurnPhase('idle')
        log('error', `[burn] failed: ${msg} (after ${String(elapsedMs)} ms)`)
        pushError({ source: 'system', code: 'BURN_FAILED', message: msg })
        toast.error(`Failed to push config: ${msg}`)
        showBurnFailure(
          {
            message: msg,
            hints: burnRemediationHints(msg),
            elapsedMs,
            schemaVersion: config.version,
            payloadBytes,
          },
          doBurn
        )
      }

      void usbService
        .pushConfig(config)
        .then((result) => {
          const elapsedMs = Math.round(performance.now() - startedAt)
          if (result.success) {
            setSyncComplete(new Date())
            setLastPushedConfig(config)
            // Firmware acked → it now writes to storage and reboots.
            // Connection will drop within ~1 s; auto-connect picks it back up
            // after the splash. The 'done' transition lives in useUsbConnection.
            setBurnPhase('rebooting')
            log(
              'success',
              `[burn] ok — wrote ${payloadKb} KB in ${String(elapsedMs)} ms (schema v${config.version})`
            )
            log('info', '[burn] device is rebooting — reconnect in a few seconds')
            toast.success('Config sent to device')
            // Auto-close the failure modal if a previous attempt left it open.
            dismissBurnFailure()
          } else {
            const rawMsg = result.error ?? 'Burn failed'
            const hint = burnErrorHint(rawMsg, firmwareVersion)
            const detailedMsg = hint !== null ? `${rawMsg} — ${hint}` : rawMsg
            handleFailure(detailedMsg, elapsedMs)
          }
        })
        .catch(() => {
          const elapsedMs = Math.round(performance.now() - startedAt)
          handleFailure('Config burn error', elapsedMs)
        })
    }

    // Show diff dialog if there's a previous push to compare against
    showDiff(config, lastPushedConfig, doBurn)
  }, [
    config,
    connected,
    syncing,
    simulationMode,
    setSyncing,
    setSyncComplete,
    setError,
    log,
    pushError,
    lastPushedConfig,
    setLastPushedConfig,
    setBurnPhase,
    showDiff,
    showBurnFailure,
    dismissBurnFailure,
    firmwareVersion,
  ])

  return {
    openConfig,
    openConfigPath,
    importConfig,
    exportConfig,
    saveConfig,
    burnConfig,
    config,
    connected,
    syncing,
    canBurn,
  }
}

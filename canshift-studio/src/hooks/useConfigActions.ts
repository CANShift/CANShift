// useConfigActions.ts — Config open / save / burn operations shared across toolbar and menu

import { useCallback } from 'react'
import type { DashboardConfig } from '@tmbk/canshift-core'
import { validateDashboard, migrateConfig, CURRENT_SCHEMA_VERSION } from '@tmbk/canshift-core'
import { useDashboardStore } from '../stores/dashboard.store'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'
import { useErrorStore } from '../stores/error.store'
import { usePushDiffStore } from '../stores/pushDiff.store'
import { configService, usbService } from '../services/ipc.service'

export function useConfigActions() {
  const config = useDashboardStore((s) => s.config)
  const setConfig = useDashboardStore((s) => s.setConfig)
  const loadImported = useDashboardStore((s) => s.loadImported)
  const markSaved = useDashboardStore((s) => s.markSaved)

  const connected = useDeviceStore((s) => s.connected)
  const syncing = useDeviceStore((s) => s.syncing)
  const setSyncing = useDeviceStore((s) => s.setSyncing)
  const setSyncComplete = useDeviceStore((s) => s.setSyncComplete)
  const setError = useDeviceStore((s) => s.setError)
  const lastPushedConfig = useDeviceStore((s) => s.lastPushedConfig)
  const setLastPushedConfig = useDeviceStore((s) => s.setLastPushedConfig)
  const setBurnPhase = useDeviceStore((s) => s.setBurnPhase)

  const showDiff = usePushDiffStore((s) => s.show)

  const log = useLogStore((s) => s.push)
  const pushError = useErrorStore((s) => s.push)

  const applyOpenResult = useCallback(
    (result: Awaited<ReturnType<typeof configService.open>>) => {
      if (result.success && result.content) {
        let config = result.content as DashboardConfig
        try {
          const { config: migrated, applied } = migrateConfig(
            config as unknown as Record<string, unknown>,
            CURRENT_SCHEMA_VERSION
          )
          config = migrated as unknown as DashboardConfig
          if (applied.length > 0) {
            log('info', `Config migrated: ${applied.join(', ')}`)
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          log('error', `Migration failed: ${msg}`)
          pushError({ source: 'config', code: 'MIGRATION_FAILED', message: msg })
        }
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
        const { config: migrated, applied } = migrateConfig(
          imported as unknown as Record<string, unknown>,
          CURRENT_SCHEMA_VERSION
        )
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
      } else if (!result.success && result.error) {
        log('error', `Save failed: ${result.error}`)
        pushError({ source: 'config', code: 'SAVE_FAILED', message: result.error })
      }
    })
  }, [config, markSaved, log, pushError])

  const burnConfig = useCallback(() => {
    if (!config || !connected || syncing) return

    // Validate before pushing — refuse to burn an invalid config
    const validation = validateDashboard(config)
    if (!validation.valid) {
      validation.errors.forEach((err) => {
        log('error', `Validation: ${err}`)
      })
      const summary = `Burn aborted — ${String(validation.errors.length)} validation error(s)`
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
      log('warn', `Validation: ${w}`)
    })

    const doBurn = () => {
      setSyncing(true)
      setBurnPhase('pushing')
      // Payload size — what the firmware will actually receive over the wire.
      // Use the same JSON.stringify the IPC layer applies so the count matches.
      const payloadBytes = new TextEncoder().encode(JSON.stringify(config)).length
      const payloadKb = (payloadBytes / 1024).toFixed(1)
      log(
        'info',
        `Burning config to device — schema v${config.version}, ${payloadKb} KB (${String(payloadBytes)} bytes)`
      )
      const startedAt = performance.now()
      void usbService
        .pushConfig(config)
        .then((result) => {
          const elapsedMs = Math.round(performance.now() - startedAt)
          if (result.success) {
            setSyncComplete(new Date())
            setLastPushedConfig(config)
            // Firmware acked → it now writes to SD and reboots. Connection
            // will drop within ~1 s; auto-connect picks it back up after the
            // splash. The 'done' transition lives in useUsbConnection.
            setBurnPhase('rebooting')
            log(
              'success',
              `Config written to device — ${payloadKb} KB in ${String(elapsedMs)} ms (schema v${config.version})`
            )
            log('info', 'Device is rebooting — reconnect in a few seconds')
          } else {
            const msg = result.error ?? 'Burn failed'
            setError(msg)
            setSyncing(false)
            setBurnPhase('idle')
            log('error', `${msg} (after ${String(elapsedMs)} ms)`)
            pushError({ source: 'system', code: 'BURN_FAILED', message: msg })
          }
        })
        .catch(() => {
          const elapsedMs = Math.round(performance.now() - startedAt)
          const msg = `Config burn error (after ${String(elapsedMs)} ms)`
          setError(msg)
          setSyncing(false)
          setBurnPhase('idle')
          log('error', msg)
          pushError({ source: 'system', code: 'BURN_FAILED', message: msg })
        })
    }

    // Show diff dialog if there's a previous push to compare against
    showDiff(config, lastPushedConfig, doBurn)
  }, [
    config,
    connected,
    syncing,
    setSyncing,
    setSyncComplete,
    setError,
    log,
    pushError,
    lastPushedConfig,
    setLastPushedConfig,
    setBurnPhase,
    showDiff,
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
  }
}

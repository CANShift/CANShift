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
  const markSaved = useDashboardStore((s) => s.markSaved)

  const connected = useDeviceStore((s) => s.connected)
  const syncing = useDeviceStore((s) => s.syncing)
  const setSyncing = useDeviceStore((s) => s.setSyncing)
  const setSyncComplete = useDeviceStore((s) => s.setSyncComplete)
  const setError = useDeviceStore((s) => s.setError)
  const lastPushedConfig = useDeviceStore((s) => s.lastPushedConfig)
  const setLastPushedConfig = useDeviceStore((s) => s.setLastPushedConfig)

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

    const doBurn = () => {
      setSyncing(true)
      log('info', 'Burning config to device…')
      void usbService
        .pushConfig(config)
        .then((result) => {
          if (result.success) {
            setSyncComplete(new Date())
            setLastPushedConfig(config)
            log('success', 'Config written to device')
            log('info', 'Device is rebooting — reconnect in a few seconds')
          } else {
            const msg = result.error ?? 'Burn failed'
            setError(msg)
            setSyncing(false)
            log('error', msg)
            pushError({ source: 'system', code: 'BURN_FAILED', message: msg })
          }
        })
        .catch(() => {
          const msg = 'Config burn error'
          setError(msg)
          setSyncing(false)
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
    showDiff,
  ])

  return { openConfig, openConfigPath, saveConfig, burnConfig, config, connected, syncing }
}

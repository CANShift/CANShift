// useConfigActions.ts — Config open / save / burn operations shared across toolbar and menu

import { useCallback } from 'react'
import type { DashboardConfig } from '@tmbk/canshift-core'
import { validateDashboard, migrateConfig, CURRENT_SCHEMA_VERSION } from '@tmbk/canshift-core'
import { useDashboardStore } from '../stores/dashboard.store'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'
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

  const openConfig = useCallback(() => {
    void configService.open().then((result) => {
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
          log('error', `Migration failed: ${err instanceof Error ? err.message : String(err)}`)
        }
        setConfig(config, result.filePath)
        log('info', `Opened ${result.filePath ?? 'config'}`)
      } else if (!result.success && result.error) {
        log('error', `Open failed: ${result.error}`)
      }
    })
  }, [setConfig, log])

  const saveConfig = useCallback(() => {
    if (!config) return
    void configService.save(config).then((result) => {
      if (result.success && result.filePath) {
        markSaved(result.filePath)
        log('success', `Saved to ${result.filePath}`)
      } else if (!result.success && result.error) {
        log('error', `Save failed: ${result.error}`)
      }
    })
  }, [config, markSaved, log])

  const burnConfig = useCallback(() => {
    if (!config || !connected || syncing) return

    // Validate before pushing — refuse to burn an invalid config
    const validation = validateDashboard(config)
    if (!validation.valid) {
      validation.errors.forEach((err) => {
        log('error', `Validation: ${err}`)
      })
      log('error', `Burn aborted — ${String(validation.errors.length)} validation error(s)`)
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
            // The firmware reboots immediately after acknowledging the push.
            // The USB disconnect event will fire in ~150ms and update the
            // connection status automatically — no extra action needed here.
            log('success', 'Config written to device')
            log('info', 'Device is rebooting — reconnect in a few seconds')
          } else {
            const msg = result.error ?? 'Burn failed'
            setError(msg)
            setSyncing(false)
            log('error', msg)
          }
        })
        .catch(() => {
          setError('Burn error')
          setSyncing(false)
          log('error', 'Config burn error')
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
    lastPushedConfig,
    setLastPushedConfig,
    showDiff,
  ])

  return { openConfig, saveConfig, burnConfig, config, connected, syncing }
}

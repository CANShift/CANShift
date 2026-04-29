// useConfigActions.ts — Config open / save / burn operations shared across toolbar and menu

import { useCallback } from 'react'
import type { DashboardConfig } from '@tmbk/canshift-core'
import { useDashboardStore } from '../stores/dashboard.store'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'
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

  const log = useLogStore((s) => s.push)

  const openConfig = useCallback(() => {
    void configService.open().then((result) => {
      if (result.success && result.content) {
        setConfig(result.content as DashboardConfig, result.filePath)
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
    setSyncing(true)
    log('info', 'Burning config to device…')
    void usbService
      .pushConfig(config)
      .then((result) => {
        if (result.success) {
          setSyncComplete(new Date())
          log('success', 'Config burned successfully')
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
  }, [config, connected, syncing, setSyncing, setSyncComplete, setError, log])

  return { openConfig, saveConfig, burnConfig, config, connected, syncing }
}

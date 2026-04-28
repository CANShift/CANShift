// useMenuEvents.ts — Listens for menu-triggered IPC events (File > Open, Save, etc.)
// and dispatches them to the appropriate store actions + IPC service calls.

import { useEffect } from 'react'
import type { DashboardConfig } from '@tmbk/canshift-core'
import { useDashboardStore } from '../stores/dashboard.store'
import { configService } from '../services/ipc.service'
import { IpcChannels } from '../../main/ipc/ipc-channels'

export function useMenuEvents() {
  const config = useDashboardStore((s) => s.config)
  const setConfig = useDashboardStore((s) => s.setConfig)
  const markSaved = useDashboardStore((s) => s.markSaved)

  useEffect(() => {
    const handleOpen = () => {
      void configService.open().then((result) => {
        if (result.success && result.content) {
          setConfig(result.content as DashboardConfig, result.filePath)
        }
      })
    }

    const handleSave = () => {
      if (!config) return
      void configService.save(config).then((result) => {
        if (result.success && result.filePath) markSaved(result.filePath)
      })
    }

    const handleSaveAs = () => {
      if (!config) return
      void configService.saveAs(config).then((result) => {
        if (result.success && result.filePath) markSaved(result.filePath)
      })
    }

    window.ipc.on(IpcChannels.CONFIG_OPEN, handleOpen)
    window.ipc.on(IpcChannels.CONFIG_SAVE, handleSave)
    window.ipc.on(IpcChannels.CONFIG_SAVE_AS, handleSaveAs)

    return () => {
      window.ipc.off(IpcChannels.CONFIG_OPEN, handleOpen)
      window.ipc.off(IpcChannels.CONFIG_SAVE, handleSave)
      window.ipc.off(IpcChannels.CONFIG_SAVE_AS, handleSaveAs)
    }
  }, [config, setConfig, markSaved])
}

// useMenuEvents.ts — Listens for menu-triggered IPC events (File > Open, Save, etc.)
// and dispatches them via useConfigActions.

import { useEffect } from 'react'
import { useDashboardStore } from '../stores/dashboard.store'
import { configService } from '../services/ipc.service'
import { useConfigActions } from './useConfigActions'
import { IpcChannels } from '../../main/ipc/ipc-channels'

export function useMenuEvents() {
  const config = useDashboardStore((s) => s.config)
  const markSaved = useDashboardStore((s) => s.markSaved)
  const { openConfig, saveConfig } = useConfigActions()

  useEffect(() => {
    const handleSaveAs = () => {
      if (!config) return
      void configService.saveAs(config).then((result) => {
        if (result.success && result.filePath) markSaved(result.filePath)
      })
    }

    window.ipc.on(IpcChannels.CONFIG_OPEN, openConfig)
    window.ipc.on(IpcChannels.CONFIG_SAVE, saveConfig)
    window.ipc.on(IpcChannels.CONFIG_SAVE_AS, handleSaveAs)

    return () => {
      window.ipc.off(IpcChannels.CONFIG_OPEN, openConfig)
      window.ipc.off(IpcChannels.CONFIG_SAVE, saveConfig)
      window.ipc.off(IpcChannels.CONFIG_SAVE_AS, handleSaveAs)
    }
  }, [config, markSaved, openConfig, saveConfig])
}

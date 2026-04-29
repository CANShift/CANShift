// useMenuEvents.ts — Listens for menu-triggered IPC events (File > Open, Save, etc.)
// and dispatches them via useConfigActions.

import { useEffect, useRef } from 'react'
import { useDashboardStore } from '../stores/dashboard.store'
import { configService } from '../services/ipc.service'
import { useConfigActions } from './useConfigActions'
import { IpcChannels } from '../../main/ipc/ipc-channels'

export function useMenuEvents() {
  const configRef = useRef(useDashboardStore.getState().config)
  const markSaved = useDashboardStore((s) => s.markSaved)
  const { openConfig, saveConfig } = useConfigActions()

  // Keep refs current without triggering effect re-registration
  const openConfigRef = useRef(openConfig)
  const saveConfigRef = useRef(saveConfig)
  const markSavedRef = useRef(markSaved)
  openConfigRef.current = openConfig
  saveConfigRef.current = saveConfig
  markSavedRef.current = markSaved

  useEffect(() => {
    // Sync config ref when store changes
    const unsub = useDashboardStore.subscribe((s) => {
      configRef.current = s.config
    })

    const handleOpen = () => {
      openConfigRef.current()
    }
    const handleSave = () => {
      saveConfigRef.current()
    }
    const handleSaveAs = () => {
      const config = configRef.current
      if (!config) return
      void configService.saveAs(config).then((result) => {
        if (result.success && result.filePath) markSavedRef.current(result.filePath)
      })
    }

    window.ipc.on(IpcChannels.CONFIG_OPEN, handleOpen)
    window.ipc.on(IpcChannels.CONFIG_SAVE, handleSave)
    window.ipc.on(IpcChannels.CONFIG_SAVE_AS, handleSaveAs)

    return () => {
      window.ipc.off(IpcChannels.CONFIG_OPEN, handleOpen)
      window.ipc.off(IpcChannels.CONFIG_SAVE, handleSave)
      window.ipc.off(IpcChannels.CONFIG_SAVE_AS, handleSaveAs)
      unsub()
    }
  }, []) // stable refs — register once, never re-register
}

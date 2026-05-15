// useMenuEvents.ts — Listens for menu-triggered IPC events (File > Open, Save, Edit > Undo, etc.)
// and dispatches them via useConfigActions or the dashboard store.

import { useEffect, useRef } from 'react'
import { useDashboardStore } from '../stores/dashboard.store'
import { configService } from '../services/ipc.service'
import { useConfigActions } from './useConfigActions'
import { IpcChannels } from '../../shared/ipc-channels'

export function useMenuEvents() {
  const configRef = useRef(useDashboardStore.getState().config)
  const markSaved = useDashboardStore((s) => s.markSaved)
  const undo = useDashboardStore((s) => s.undo)
  const redo = useDashboardStore((s) => s.redo)
  const duplicateWidgets = useDashboardStore((s) => s.duplicateWidgets)
  const { openConfig, openConfigPath, importConfig, exportConfig, saveConfig } = useConfigActions()

  // Keep refs current without triggering effect re-registration
  const openConfigRef = useRef(openConfig)
  const openConfigPathRef = useRef(openConfigPath)
  const importConfigRef = useRef(importConfig)
  const exportConfigRef = useRef(exportConfig)
  const saveConfigRef = useRef(saveConfig)
  const markSavedRef = useRef(markSaved)
  const undoRef = useRef(undo)
  const redoRef = useRef(redo)
  const duplicateRef = useRef(duplicateWidgets)
  openConfigRef.current = openConfig
  openConfigPathRef.current = openConfigPath
  importConfigRef.current = importConfig
  exportConfigRef.current = exportConfig
  saveConfigRef.current = saveConfig
  markSavedRef.current = markSaved
  undoRef.current = undo
  redoRef.current = redo
  duplicateRef.current = duplicateWidgets

  useEffect(() => {
    const unsub = useDashboardStore.subscribe((s) => {
      configRef.current = s.config
    })

    const handleOpen = () => {
      openConfigRef.current()
    }
    const handleOpenPath = (filePath: unknown) => {
      if (typeof filePath === 'string') openConfigPathRef.current(filePath)
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
    const handleImport = () => {
      importConfigRef.current()
    }
    const handleExport = () => {
      exportConfigRef.current()
    }
    const handleUndo = () => {
      undoRef.current()
    }
    const handleRedo = () => {
      redoRef.current()
    }
    const handleDuplicate = () => {
      const state = useDashboardStore.getState()
      const pageId = state.selectedPageId
      const ids =
        state.selectedWidgetIds.length > 0
          ? state.selectedWidgetIds
          : state.selectedWidgetId
            ? [state.selectedWidgetId]
            : []
      if (!pageId || ids.length === 0) return
      duplicateRef.current(pageId, ids)
    }

    window.ipc.on(IpcChannels.CONFIG_OPEN, handleOpen)
    window.ipc.on(IpcChannels.CONFIG_OPEN_PATH, handleOpenPath)
    window.ipc.on(IpcChannels.CONFIG_SAVE, handleSave)
    window.ipc.on(IpcChannels.CONFIG_SAVE_AS, handleSaveAs)
    window.ipc.on(IpcChannels.CONFIG_IMPORT, handleImport)
    window.ipc.on(IpcChannels.CONFIG_EXPORT, handleExport)
    window.ipc.on(IpcChannels.HISTORY_UNDO, handleUndo)
    window.ipc.on(IpcChannels.HISTORY_REDO, handleRedo)
    window.ipc.on(IpcChannels.EDIT_DUPLICATE, handleDuplicate)

    return () => {
      window.ipc.off(IpcChannels.CONFIG_OPEN, handleOpen)
      window.ipc.off(IpcChannels.CONFIG_OPEN_PATH, handleOpenPath)
      window.ipc.off(IpcChannels.CONFIG_SAVE, handleSave)
      window.ipc.off(IpcChannels.CONFIG_SAVE_AS, handleSaveAs)
      window.ipc.off(IpcChannels.CONFIG_IMPORT, handleImport)
      window.ipc.off(IpcChannels.CONFIG_EXPORT, handleExport)
      window.ipc.off(IpcChannels.HISTORY_UNDO, handleUndo)
      window.ipc.off(IpcChannels.HISTORY_REDO, handleRedo)
      window.ipc.off(IpcChannels.EDIT_DUPLICATE, handleDuplicate)
      unsub()
    }
  }, []) // stable refs — register once, never re-register
}

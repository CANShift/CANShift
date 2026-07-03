import { useEffect } from 'react'
import { useDashboardStore } from '../stores/dashboard.store'
import { isEditableTarget } from '../utils/is-editable-target'

export interface UseClipboardWidgetsOptions {
  copyWidgets: (pageId: string, widgetIds: string[]) => void
  removeWidgets: (pageId: string, widgetIds: string[]) => void
  pasteWidgets: (pageId: string) => void
}

export const useClipboardWidgets = ({
  copyWidgets,
  removeWidgets,
  pasteWidgets,
}: UseClipboardWidgetsOptions): void => {
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      if (isEditableTarget(e.target)) return
      const { selectedWidgetIds: ids, selectedPageId } = useDashboardStore.getState()
      if (ids.length === 0 || !selectedPageId) return
      e.preventDefault()
      copyWidgets(selectedPageId, ids)
    }

    const handleCut = (e: ClipboardEvent) => {
      if (isEditableTarget(e.target)) return
      const { selectedWidgetIds: ids, selectedPageId } = useDashboardStore.getState()
      if (ids.length === 0 || !selectedPageId) return
      e.preventDefault()
      copyWidgets(selectedPageId, ids)
      removeWidgets(selectedPageId, ids)
    }

    const handlePaste = (e: ClipboardEvent) => {
      if (isEditableTarget(e.target)) return
      const { clipboardWidgets, selectedPageId } = useDashboardStore.getState()
      if (clipboardWidgets.length === 0 || !selectedPageId) return
      e.preventDefault()
      pasteWidgets(selectedPageId)
    }

    document.addEventListener('copy', handleCopy)
    document.addEventListener('cut', handleCut)
    document.addEventListener('paste', handlePaste)
    return () => {
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('cut', handleCut)
      document.removeEventListener('paste', handlePaste)
    }
  }, [copyWidgets, removeWidgets, pasteWidgets])
}

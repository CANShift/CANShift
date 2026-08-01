import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react'
import type { Widget } from '@tmbk/canshift-core'
import { useDashboardStore } from '../stores/dashboard.store'
import { isEditableTarget } from '../utils/is-editable-target'

export interface CanvasKeyboardRef {
  pageId: string
  pageWidgets: readonly Widget[]
}

export interface UseCanvasKeyboardOptions {
  selectWidget: (widgetId: string | null) => void
  selectWidgets: (widgetIds: string[]) => void
  removeWidgets: (pageId: string, widgetIds: string[]) => void
  nudgeWidgets: (pageId: string, widgetIds: string[], dx: number, dy: number) => void
  kbdRef: RefObject<CanvasKeyboardRef>
  setShortcutsOpen: Dispatch<SetStateAction<boolean>>
}

export const useCanvasKeyboard = ({
  selectWidget,
  selectWidgets,
  removeWidgets,
  nudgeWidgets,
  kbdRef,
  setShortcutsOpen,
}: UseCanvasKeyboardOptions): void => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return

      const { selectedWidgetIds: activeIds } = useDashboardStore.getState()

      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setShortcutsOpen(false)
        selectWidget(null)
        return
      }

      if (e.key === '?') {
        e.preventDefault()
        e.stopPropagation()
        setShortcutsOpen((o) => !o)
        return
      }

      const isMod = e.metaKey || e.ctrlKey
      if (isMod && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
        e.preventDefault()
        e.stopPropagation()
        const { undo: doUndo, redo: doRedo } = useDashboardStore.getState()
        if (e.key.toLowerCase() === 'y' || e.shiftKey) doRedo()
        else doUndo()
        return
      }

      const kbd = kbdRef.current
      if (!kbd) return

      if (isMod && e.key === 'a') {
        e.preventDefault()
        e.stopPropagation()
        const allIds = kbd.pageWidgets.map((w) => w.id)
        if (allIds.length > 0) selectWidgets(allIds)
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeIds.length === 0) return
        e.preventDefault()
        e.stopPropagation()
        removeWidgets(kbd.pageId, activeIds)
        return
      }

      if (
        activeIds.length > 0 &&
        (e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight' ||
          e.key === 'ArrowUp' ||
          e.key === 'ArrowDown')
      ) {
        e.preventDefault()
        e.stopPropagation()
        const step = e.shiftKey ? 3 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        nudgeWidgets(kbd.pageId, activeIds, dx, dy)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true })
    }
  }, [selectWidget, selectWidgets, removeWidgets, nudgeWidgets, kbdRef, setShortcutsOpen])
}

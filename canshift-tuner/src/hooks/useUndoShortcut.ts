import { useEffect } from 'react'
import { useDashboardStore } from '../stores/dashboard.store'
import { isEditableTarget } from '../utils/is-editable-target'

export const useUndoShortcut = (): void => {
  const undo = useDashboardStore((s) => s.undo)
  const redo = useDashboardStore((s) => s.redo)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      if (!isMod) return
      const key = e.key.toLowerCase()
      const isRedo = (key === 'z' && e.shiftKey) || key === 'y'
      const isUndo = key === 'z' && !e.shiftKey
      if (!isUndo && !isRedo) return
      if (isEditableTarget(e.target)) return
      e.preventDefault()
      if (isRedo) redo()
      else undo()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [undo, redo])
}

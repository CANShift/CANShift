import { create } from 'zustand'
import { useDashboardStore } from './dashboard.store'

export const UNDO_TOAST_MS = 8000

export interface UndoToast {
  id: number
  label: string
}

interface UndoToastState {
  toast: UndoToast | null
  showForLastAction: () => void
  undoFromToast: () => void
  dismiss: (id: number) => void
}

let nextToastId = 1

export const useUndoToastStore = create<UndoToastState>()((set, get) => ({
  toast: null,

  showForLastAction: () => {
    const past = useDashboardStore.getState().past
    const label = past[past.length - 1]?.label
    if (!label) return
    set({ toast: { id: nextToastId++, label } })
  },

  undoFromToast: () => {
    useDashboardStore.getState().undo()
    set({ toast: null })
  },

  dismiss: (id) => {
    if (get().toast?.id === id) set({ toast: null })
  },
}))

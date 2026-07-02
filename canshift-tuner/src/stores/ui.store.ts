import { create } from 'zustand'

const SIDEBAR_COLLAPSED_KEY = 'canshift.ui.sidebar-collapsed'

const readSidebarCollapsed = (): boolean => {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

const writeSidebarCollapsed = (collapsed: boolean): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    void 0
  }
}

interface UiState {
  sidebarCollapsed: boolean
  burnDeniedAt: number | null
  toggleSidebar: () => void
  signalBurnDenied: () => void
}

export const useUiStore = create<UiState>((set, get) => ({
  sidebarCollapsed: readSidebarCollapsed(),
  burnDeniedAt: null,
  toggleSidebar: () => {
    const next = !get().sidebarCollapsed
    writeSidebarCollapsed(next)
    set({ sidebarCollapsed: next })
  },
  signalBurnDenied: () => {
    set({ burnDeniedAt: Date.now() })
  },
}))

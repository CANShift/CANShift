import { create } from 'zustand'

interface UiState {
  burnDeniedAt: number | null
  signalBurnDenied: () => void
}

export const useUiStore = create<UiState>((set) => ({
  burnDeniedAt: null,
  signalBurnDenied: () => {
    set({ burnDeniedAt: Date.now() })
  },
}))

import { create } from 'zustand'

interface UiState {
  burnDeniedAt: number | null
  signalBurnDenied: () => void
  unboundBurnConfirm: number | null
  requestUnboundBurnConfirm: (count: number) => void
  clearUnboundBurnConfirm: () => void
}

export const useUiStore = create<UiState>((set) => ({
  burnDeniedAt: null,
  signalBurnDenied: () => {
    set({ burnDeniedAt: Date.now() })
  },
  unboundBurnConfirm: null,
  requestUnboundBurnConfirm: (count) => {
    set({ unboundBurnConfirm: count })
  },
  clearUnboundBurnConfirm: () => {
    set({ unboundBurnConfirm: null })
  },
}))

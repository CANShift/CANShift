import { create } from 'zustand'

export const REBIND_FLASH_MS = 200

interface RebindFlashState {
  flashId: string | null
  flash: (widgetId: string) => void
}

let flashTimer: ReturnType<typeof setTimeout> | null = null

export const useRebindFlashStore = create<RebindFlashState>()((set) => ({
  flashId: null,
  flash: (widgetId) => {
    if (flashTimer !== null) clearTimeout(flashTimer)
    set({ flashId: widgetId })
    flashTimer = setTimeout(() => {
      flashTimer = null
      set({ flashId: null })
    }, REBIND_FLASH_MS)
  },
}))

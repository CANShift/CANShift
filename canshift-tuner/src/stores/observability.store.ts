import { create } from 'zustand'

const STORAGE_KEY = 'canshift.tuner.observability'

const readStored = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

const writeStored = (enabled: boolean): void => {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
  } catch {
    void 0
  }
}

interface ObservabilityState {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
}

export const useObservabilityStore = create<ObservabilityState>()((set) => ({
  enabled: readStored(),
  setEnabled: (enabled) => {
    writeStored(enabled)
    set({ enabled })
  },
}))

export const isObservabilityEnabled = (): boolean => useObservabilityStore.getState().enabled

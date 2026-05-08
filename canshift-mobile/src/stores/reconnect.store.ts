// reconnect.store.ts — UI state for the BLE auto-reconnect loop

import { create } from 'zustand'

interface ReconnectState {
  isReconnecting: boolean
  attempt: number
  maxAttempts: number
  deviceId: string | null

  start: (deviceId: string, maxAttempts: number) => void
  setAttempt: (attempt: number) => void
  stop: () => void
}

export const useReconnectStore = create<ReconnectState>()((set) => ({
  isReconnecting: false,
  attempt: 0,
  maxAttempts: 0,
  deviceId: null,

  start: (deviceId, maxAttempts) => {
    set({ isReconnecting: true, attempt: 0, maxAttempts, deviceId })
  },

  setAttempt: (attempt) => {
    set({ attempt })
  },

  stop: () => {
    set({ isReconnecting: false, attempt: 0, maxAttempts: 0, deviceId: null })
  },
}))

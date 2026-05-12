// log.store.ts — Circular buffer of app-level log events

import { create } from 'zustand'

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  id: string
  timestamp: number
  level: LogLevel
  message: string
}

const MAX_ENTRIES = 200

interface LogState {
  entries: LogEntry[]
  log: (level: LogLevel, message: string) => void
  clear: () => void
}

export const useLogStore = create<LogState>()((set) => ({
  entries: [],

  log: (level, message) => {
    set((state) => {
      const entry: LogEntry = {
        id: `${String(Date.now())}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
        level,
        message,
      }
      return { entries: [entry, ...state.entries].slice(0, MAX_ENTRIES) }
    })
  },

  clear: () => {
    set({ entries: [] })
  },
}))

export const log = (level: LogLevel, message: string) => {
  useLogStore.getState().log(level, message)
}

// log.store.ts — Application console log entries

import { create } from 'zustand'

export type LogLevel = 'info' | 'warn' | 'error' | 'success'

export interface LogEntry {
  id: number
  level: LogLevel
  message: string
  timestamp: Date
}

interface LogState {
  entries: LogEntry[]
  push: (level: LogLevel, message: string) => void
  clear: () => void
}

let nextId = 1

export const useLogStore = create<LogState>()((set) => ({
  entries: [],

  push: (level, message) => {
    set((s) => ({
      entries: [...s.entries, { id: nextId++, level, message, timestamp: new Date() }],
    }))
  },

  clear: () => {
    set({ entries: [] })
  },
}))

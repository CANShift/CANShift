// log.store.ts — Application console log entries
//
// Verbose mode controls whether `debug` lines (high-volume traces such as
// per-chunk SD push progress) are kept in `entries`. When verbose is off
// `push` drops debug records on the floor so the visible log stays
// user-readable. The toggle is persisted across reloads via localStorage so
// debugging sessions survive a window restart.

import { create } from 'zustand'

export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug'

export interface LogEntry {
  id: number
  level: LogLevel
  message: string
  timestamp: Date
}

interface LogState {
  entries: LogEntry[]
  verbose: boolean
  push: (level: LogLevel, message: string) => void
  setVerbose: (verbose: boolean) => void
  clear: () => void
}

const VERBOSE_STORAGE_KEY = 'canshift.log.verbose'

function readVerboseFlag(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(VERBOSE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeVerboseFlag(verbose: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(VERBOSE_STORAGE_KEY, verbose ? '1' : '0')
  } catch {
    /* localStorage unavailable (private mode, denied) — keep in-memory state */
  }
}

let nextId = 1

export const useLogStore = create<LogState>()((set, get) => ({
  entries: [],
  verbose: readVerboseFlag(),

  push: (level, message) => {
    if (level === 'debug' && !get().verbose) return
    set((s) => ({
      entries: [...s.entries, { id: nextId++, level, message, timestamp: new Date() }],
    }))
  },

  setVerbose: (verbose) => {
    writeVerboseFlag(verbose)
    set({ verbose })
  },

  clear: () => {
    set({ entries: [] })
  },
}))

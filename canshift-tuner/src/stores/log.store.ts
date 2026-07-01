import { create } from 'zustand'

export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug'

export interface LogEntry {
  id: number
  level: LogLevel
  message: string
  timestamp: Date
  scope?: string
  bridged?: boolean
}

interface LogState {
  entries: LogEntry[]
  verbose: boolean
  push: (level: LogLevel, message: string, scope?: string) => void
  pushFromBridge: (entry: LogEntry) => void
  setVerbose: (verbose: boolean) => void
  clear: () => void
}

const VERBOSE_STORAGE_KEY = 'canshift.log.verbose'

const readVerboseFlag = (): boolean => {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(VERBOSE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

const writeVerboseFlag = (verbose: boolean): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(VERBOSE_STORAGE_KEY, verbose ? '1' : '0')
  } catch {
    void 0
  }
}

export const LOG_RING_CAP = 2000

const appendCapped = (entries: LogEntry[], entry: LogEntry): LogEntry[] => {
  const next = entries.concat(entry)
  if (next.length > LOG_RING_CAP) {
    next.splice(0, next.length - LOG_RING_CAP)
  }
  return next
}

let nextId = 1

export const useLogStore = create<LogState>()((set, get) => ({
  entries: [],
  verbose: readVerboseFlag(),

  push: (level, message, scope) => {
    if (level === 'debug' && !get().verbose) return
    const entry: LogEntry =
      scope !== undefined
        ? { id: nextId++, level, message, timestamp: new Date(), scope }
        : { id: nextId++, level, message, timestamp: new Date() }
    set((s) => ({
      entries: appendCapped(s.entries, entry),
    }))
  },

  pushFromBridge: (entry) => {
    if (entry.level === 'debug' && !get().verbose) return
    const base: LogEntry = {
      id: nextId++,
      level: entry.level,
      message: entry.message,
      timestamp: entry.timestamp,
      bridged: true,
    }
    const local: LogEntry = entry.scope !== undefined ? { ...base, scope: entry.scope } : base
    set((s) => ({
      entries: appendCapped(s.entries, local),
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

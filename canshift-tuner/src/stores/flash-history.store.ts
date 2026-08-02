import { create } from 'zustand'

export interface FlashHistoryEntry {
  label: string
  at: string
  ok: boolean
}

const STORAGE_KEY = 'canshift.tuner.flash-history'
const HISTORY_CAP = 20

const readStoredHistory = (): FlashHistoryEntry[] => {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is FlashHistoryEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as FlashHistoryEntry).label === 'string' &&
        typeof (e as FlashHistoryEntry).at === 'string' &&
        typeof (e as FlashHistoryEntry).ok === 'boolean'
    )
  } catch {
    return []
  }
}

const writeStoredHistory = (entries: FlashHistoryEntry[]): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    void 0
  }
}

interface FlashHistoryState {
  entries: FlashHistoryEntry[]
  record: (label: string, ok: boolean) => void
}

export const useFlashHistoryStore = create<FlashHistoryState>()((set, get) => ({
  entries: readStoredHistory(),

  record: (label, ok) => {
    const entry: FlashHistoryEntry = { label, at: new Date().toISOString(), ok }
    const next = [entry, ...get().entries].slice(0, HISTORY_CAP)
    writeStoredHistory(next)
    set({ entries: next })
  },
}))

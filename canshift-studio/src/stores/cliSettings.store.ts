// cliSettings.store.ts — Feature flag for the new xterm-based CLI panel.
//
// Persisted to localStorage so the user's choice survives a reload. While the
// feature is opt-in (PR 1 → PR 2 → PR 3), the default stays `false` and the
// classic ConsolePanel keeps shipping.

import { create } from 'zustand'

const STORAGE_KEY = 'canshift.cli.enabled'

function readInitial(): boolean {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return false
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function persist(value: boolean): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false')
  } catch {
    // Storage may be unavailable (Safari private mode, quota). Swallowing
    // silently here is fine — the in-memory flag still works for this session.
  }
}

interface CliSettingsState {
  enabled: boolean
  setEnabled: (value: boolean) => void
}

export const useCliSettingsStore = create<CliSettingsState>()((set) => ({
  enabled: readInitial(),

  setEnabled: (value) => {
    persist(value)
    set({ enabled: value })
  },
}))

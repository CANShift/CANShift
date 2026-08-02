import { create } from 'zustand'

export type ChromeTheme = 'dark' | 'light'

const THEME_STORAGE_KEY = 'canshift.tuner.theme'

const readStoredTheme = (): ChromeTheme => {
  if (typeof window === 'undefined') return 'dark'
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

const writeStoredTheme = (theme: ChromeTheme): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    void 0
  }
}

const applyThemeAttribute = (theme: ChromeTheme): void => {
  if (typeof document === 'undefined') return
  if (theme === 'light') {
    document.documentElement.dataset['theme'] = 'light'
  } else {
    delete document.documentElement.dataset['theme']
  }
}

interface ThemeState {
  theme: ChromeTheme
  toggleTheme: () => void
}

const initialTheme = readStoredTheme()
applyThemeAttribute(initialTheme)

export const useThemeStore = create<ThemeState>()((set, get) => ({
  theme: initialTheme,

  toggleTheme: () => {
    const next: ChromeTheme = get().theme === 'dark' ? 'light' : 'dark'
    applyThemeAttribute(next)
    writeStoredTheme(next)
    set({ theme: next })
  },
}))

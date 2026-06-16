import { pushHistory } from './helpers'
import type { SliceCreator, ThemeSlice } from './types'

export const createThemeSlice: SliceCreator<ThemeSlice> = (set) => ({
  isPreviewDayMode: false,

  togglePreviewTheme: () => {
    set((s) => {
      s.isPreviewDayMode = !s.isPreviewDayMode
    })
  },

  setDayTheme: (theme) => {
    set((s) => {
      if (!s.config) return
      pushHistory(s)
      if (theme === null) {
        delete s.config.dayTheme
      } else {
        s.config.dayTheme = theme
      }
      s.isDirty = true
    })
  },

  setNightTheme: (theme) => {
    set((s) => {
      if (!s.config) return
      pushHistory(s)
      if (theme === null) {
        delete s.config.nightTheme
      } else {
        s.config.nightTheme = theme
      }
      s.isDirty = true
    })
  },
})

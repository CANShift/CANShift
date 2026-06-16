import { pushHistory } from './helpers'
import type { PagesSlice, SliceCreator } from './types'

export const createPagesSlice: SliceCreator<PagesSlice> = (set) => ({
  addPage: (page) => {
    set((s) => {
      if (!s.config) return
      pushHistory(s)
      s.config.pages.push(page)
      s.selectedPageId = page.id
      s.isDirty = true
    })
  },

  removePage: (pageId) => {
    set((s) => {
      if (!s.config) return
      pushHistory(s)
      s.config.pages = s.config.pages.filter((p) => p.id !== pageId)
      if (s.selectedPageId === pageId) {
        s.selectedPageId = s.config.pages[0]?.id ?? null
      }
      s.isDirty = true
    })
  },

  setDefaultPage: (pageId) => {
    set((s) => {
      if (!s.config) return
      pushHistory(s)
      s.config.defaultPageId = pageId
      s.isDirty = true
    })
  },

  updatePage: (pageId, patch) => {
    set((s) => {
      if (!s.config) return
      pushHistory(s)
      const idx = s.config.pages.findIndex((p) => p.id === pageId)
      if (idx === -1) return
      const existing = s.config.pages[idx]
      if (!existing) return
      s.config.pages[idx] = { ...existing, ...patch }
      s.isDirty = true
    })
  },

  setPageTemplate: (pageId, template) => {
    set((s) => {
      if (!s.config) return
      pushHistory(s)
      const idx = s.config.pages.findIndex((p) => p.id === pageId)
      if (idx === -1) return
      const existing = s.config.pages[idx]
      if (!existing) return
      if (template === 'custom') {
        const { template: _drop, ...rest } = existing
        s.config.pages[idx] = rest
      } else {
        s.config.pages[idx] = { ...existing, template }
      }
      s.isDirty = true
    })
  },

  movePage: (fromIndex, toIndex) => {
    set((s) => {
      if (!s.config) return
      pushHistory(s)
      const pages = s.config.pages
      if (fromIndex < 0 || fromIndex >= pages.length) return
      if (toIndex < 0 || toIndex >= pages.length) return
      const [moved] = pages.splice(fromIndex, 1)
      if (moved) pages.splice(toIndex, 0, moved)
      s.isDirty = true
    })
  },

  updateTopBar: (patch) => {
    set((s) => {
      if (!s.config) return
      pushHistory(s)
      s.config.topBar = { ...s.config.topBar, ...patch }
      s.isDirty = true
    })
  },
})

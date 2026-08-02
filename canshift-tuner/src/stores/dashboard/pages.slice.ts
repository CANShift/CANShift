import type { PageConfig } from '@tmbk/canshift-core'
import { pageRef, pushHistory } from './helpers'
import { createId } from '../../utils/id'
import type { PagesSlice, SliceCreator } from './types'

export const createPagesSlice: SliceCreator<PagesSlice> = (set, get) => ({
  addPage: (page) => {
    set((s) => {
      if (!s.config) return
      pushHistory(s, `Added ${pageRef(s.config.pages.length)}`)
      s.config.pages.push(page)
      s.selectedPageId = page.id
      s.isDirty = true
    })
  },

  duplicatePage: (pageId) => {
    const config = get().config
    if (!config) return
    const idx = config.pages.findIndex((p) => p.id === pageId)
    const original = config.pages[idx]
    if (!original) return
    const clone: PageConfig = {
      ...original,
      id: createId('page'),
      widgets: original.widgets.map((w) => ({ ...w, id: createId(w.type) })),
    }
    set((s) => {
      if (!s.config) return
      pushHistory(s, `Duplicated ${pageRef(idx)}`)
      s.config.pages.splice(idx + 1, 0, clone)
      s.selectedPageId = clone.id
      s.isDirty = true
    })
  },

  removePage: (pageId) => {
    set((s) => {
      if (!s.config) return
      const idx = s.config.pages.findIndex((p) => p.id === pageId)
      pushHistory(s, `Deleted ${idx === -1 ? 'page' : pageRef(idx)}`)
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
      const idx = s.config.pages.findIndex((p) => p.id === pageId)
      pushHistory(s, `Set ${idx === -1 ? 'page' : pageRef(idx)} as default`)
      s.config.defaultPageId = pageId
      s.isDirty = true
    })
  },

  updatePage: (pageId, patch) => {
    set((s) => {
      if (!s.config) return
      const idx = s.config.pages.findIndex((p) => p.id === pageId)
      if (idx === -1) return
      pushHistory(s, `Edited ${pageRef(idx)}`)
      const existing = s.config.pages[idx]
      if (!existing) return
      s.config.pages[idx] = { ...existing, ...patch }
      s.isDirty = true
    })
  },

  setPageTemplate: (pageId, template) => {
    set((s) => {
      if (!s.config) return
      const idx = s.config.pages.findIndex((p) => p.id === pageId)
      if (idx === -1) return
      pushHistory(s, `Changed ${pageRef(idx)} template`)
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
      pushHistory(s, 'Reordered pages')
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
      pushHistory(s, 'Edited top bar')
      s.config.topBar = { ...s.config.topBar, ...patch }
      s.isDirty = true
    })
  },
})

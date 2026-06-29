import { describe, it, expect } from 'vitest'
import type { DashboardConfig } from '@tmbk/canshift-core'
import { useDashboardStore } from '../dashboard.store'

const makeConfig = (): DashboardConfig =>
  ({
    version: '1.23.0',
    defaultPageId: 'p1',
    topBar: { height: 16, bgColor: '#000000', textColor: '#FFFFFF' },
    pages: [
      {
        id: 'p1',
        backgroundColor: '#000000',
        showTopBar: true,
        visible: true,
        widgets: [
          { id: 'gauge_a', type: 'gauge' },
          { id: 'gauge_b', type: 'gauge' },
        ],
      },
      { id: 'p2', backgroundColor: '#000000', showTopBar: true, visible: true, widgets: [] },
    ],
  }) as unknown as DashboardConfig

describe('duplicatePage (#1652)', () => {
  it('inserts the clone right after the original with fresh, unique widget ids', () => {
    useDashboardStore.getState().setConfig(makeConfig())
    useDashboardStore.getState().duplicatePage('p1')

    const pages = useDashboardStore.getState().config?.pages ?? []
    expect(pages).toHaveLength(3)
    expect(pages[0]?.id).toBe('p1')
    expect(pages[2]?.id).toBe('p2')

    const clone = pages[1]
    expect(clone?.id).not.toBe('p1')

    const originalIds = pages[0]?.widgets.map((w) => w.id) ?? []
    const cloneIds = clone?.widgets.map((w) => w.id) ?? []
    expect(cloneIds).toHaveLength(2)
    expect(cloneIds.some((id) => originalIds.includes(id))).toBe(false)
    expect(new Set(cloneIds).size).toBe(cloneIds.length)

    expect(useDashboardStore.getState().selectedPageId).toBe(clone?.id)
  })

  it('is a no-op for an unknown pageId', () => {
    useDashboardStore.getState().setConfig(makeConfig())
    const before = useDashboardStore.getState().config?.pages.length
    useDashboardStore.getState().duplicatePage('does-not-exist')
    expect(useDashboardStore.getState().config?.pages.length).toBe(before)
  })
})

// stores/__tests__/dashboard-theme.test.ts — Coverage for the dashboard
// store's day-theme actions exercised by ThemePanel (#21).
//
// Vitest runs in `node` environment per `vitest.config.ts`, so the store
// (Zustand + Immer) executes without a DOM. We reset the store between
// cases by re-seeding `setConfig` with a fresh copy of the demo config so
// edits from one test don't bleed into the next.

import { beforeEach, describe, expect, it } from 'vitest'
import { DAY_BG_DEFAULT, DAY_PALETTE_DEFAULT, DAY_THEME_PRESET } from '@tmbk/canshift-core'
import type { DashboardConfig } from '@tmbk/canshift-core'
import { useDashboardStore } from '../dashboard.store'
import { DEFAULT_SIM_CONFIG } from '../../config/defaultSimConfig'

function freshConfig(): DashboardConfig {
  // Deep clone so a mutation in one test never leaks into the next.
  return JSON.parse(JSON.stringify(DEFAULT_SIM_CONFIG)) as DashboardConfig
}

describe('dashboard.store — dayTheme actions', () => {
  beforeEach(() => {
    useDashboardStore.getState().setConfig(freshConfig())
  })

  it('backfills DAY_THEME_PRESET when the loaded config has no dayTheme', () => {
    const next = freshConfig()
    delete next.dayTheme
    useDashboardStore.getState().setConfig(next)

    const dayTheme = useDashboardStore.getState().config?.dayTheme
    expect(dayTheme).toEqual(DAY_THEME_PRESET)
  })

  it('setDayTheme replaces both bgColor and palette atomically', () => {
    const customTheme = {
      bgColor: '#101010' as const,
      palette: { ...DAY_PALETTE_DEFAULT, primary: '#FF00AA' as const },
    }
    useDashboardStore.getState().setDayTheme(customTheme)

    const dayTheme = useDashboardStore.getState().config?.dayTheme
    expect(dayTheme?.bgColor).toBe('#101010')
    expect(dayTheme?.palette?.primary).toBe('#FF00AA')
    expect(dayTheme?.palette?.surface).toBe(DAY_PALETTE_DEFAULT.surface)
  })

  it('setDayTheme marks the config dirty and pushes one history entry per call', () => {
    const before = useDashboardStore.getState()
    expect(before.isDirty).toBe(false)
    const initialPast = before.past.length

    useDashboardStore.getState().setDayTheme({
      bgColor: '#222222',
      palette: { ...DAY_PALETTE_DEFAULT, accent: '#00FF00' },
    })

    const after = useDashboardStore.getState()
    expect(after.isDirty).toBe(true)
    expect(after.past.length).toBe(initialPast + 1)
  })

  it('setDayTheme(null) clears the dayTheme field entirely', () => {
    useDashboardStore.getState().setDayTheme(null)
    const dayTheme = useDashboardStore.getState().config?.dayTheme
    expect(dayTheme).toBeUndefined()
  })

  it('undo restores the dayTheme to its previous value', () => {
    const original = useDashboardStore.getState().config?.dayTheme
    expect(original).toBeDefined()

    useDashboardStore.getState().setDayTheme({
      bgColor: '#ABCDEF',
      palette: { ...DAY_PALETTE_DEFAULT, primary: '#123456' },
    })
    expect(useDashboardStore.getState().config?.dayTheme?.bgColor).toBe('#ABCDEF')

    useDashboardStore.getState().undo()
    expect(useDashboardStore.getState().config?.dayTheme).toEqual(original)
  })

  it('reset-to-default flow restores DAY_THEME_PRESET after an edit', () => {
    useDashboardStore.getState().setDayTheme({
      bgColor: '#000000',
      palette: { ...DAY_PALETTE_DEFAULT, primary: '#FF0000' },
    })
    expect(useDashboardStore.getState().config?.dayTheme?.bgColor).toBe('#000000')

    useDashboardStore.getState().setDayTheme(DAY_THEME_PRESET)
    const dayTheme = useDashboardStore.getState().config?.dayTheme
    expect(dayTheme?.bgColor).toBe(DAY_BG_DEFAULT)
    expect(dayTheme?.palette).toEqual(DAY_PALETTE_DEFAULT)
  })
})

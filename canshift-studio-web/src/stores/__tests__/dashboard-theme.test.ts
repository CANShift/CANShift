// stores/__tests__/dashboard-theme.test.ts — Coverage for the dashboard
// store's day + night theme actions exercised by ThemePanel (#21 v2).
//
// Vitest runs in `node` environment per `vitest.config.ts`, so the store
// (Zustand + Immer) executes without a DOM. We reset the store between
// cases by re-seeding `setConfig` with a fresh copy of the demo config so
// edits from one test don't bleed into the next.

import { beforeEach, describe, expect, it } from 'vitest'
import {
  DAY_BG_DEFAULT,
  DAY_PALETTE_DEFAULT,
  DAY_THEME_PRESET,
  HexColorSchema,
  NIGHT_BG_DEFAULT,
  NIGHT_PALETTE_DEFAULT,
  NIGHT_THEME_PRESET,
  THEME_PRESETS,
  getThemePreset,
} from '@tmbk/canshift-core'
import type { DashboardConfig } from '@tmbk/canshift-core'
import { useDashboardStore } from '../dashboard.store'
import { DEFAULT_SIM_CONFIG } from '../../config/defaultSimConfig'

// Branded `HexColor` literals in test fixtures flow through the schema once.
const hex = (value: string): ReturnType<typeof HexColorSchema.parse> => HexColorSchema.parse(value)

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
      bgColor: hex('#101010'),
      palette: { ...DAY_PALETTE_DEFAULT, primary: hex('#FF00AA') },
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
      bgColor: hex('#222222'),
      palette: { ...DAY_PALETTE_DEFAULT, accent: hex('#00FF00') },
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
      bgColor: hex('#ABCDEF'),
      palette: { ...DAY_PALETTE_DEFAULT, primary: hex('#123456') },
    })
    expect(useDashboardStore.getState().config?.dayTheme?.bgColor).toBe('#ABCDEF')

    useDashboardStore.getState().undo()
    expect(useDashboardStore.getState().config?.dayTheme).toEqual(original)
  })

  it('reset-to-default flow restores DAY_THEME_PRESET after an edit', () => {
    useDashboardStore.getState().setDayTheme({
      bgColor: hex('#000000'),
      palette: { ...DAY_PALETTE_DEFAULT, primary: hex('#FF0000') },
    })
    expect(useDashboardStore.getState().config?.dayTheme?.bgColor).toBe('#000000')

    useDashboardStore.getState().setDayTheme(DAY_THEME_PRESET)
    const dayTheme = useDashboardStore.getState().config?.dayTheme
    expect(dayTheme?.bgColor).toBe(DAY_BG_DEFAULT)
    expect(dayTheme?.palette).toEqual(DAY_PALETTE_DEFAULT)
  })
})

describe('dashboard.store — nightTheme actions (#21 v2)', () => {
  beforeEach(() => {
    useDashboardStore.getState().setConfig(freshConfig())
  })

  it('leaves nightTheme undefined on a fresh config (backward compat)', () => {
    expect(useDashboardStore.getState().config?.nightTheme).toBeUndefined()
  })

  it('setNightTheme writes the value through to the config', () => {
    const custom = {
      bgColor: hex('#020202'),
      palette: { ...NIGHT_PALETTE_DEFAULT, primary: hex('#FF00AA') },
    }
    useDashboardStore.getState().setNightTheme(custom)

    const nightTheme = useDashboardStore.getState().config?.nightTheme
    expect(nightTheme?.bgColor).toBe('#020202')
    expect(nightTheme?.palette?.primary).toBe('#FF00AA')
    expect(nightTheme?.palette?.surface).toBe(NIGHT_PALETTE_DEFAULT.surface)
  })

  it('setNightTheme marks the config dirty and pushes one history entry per call', () => {
    const before = useDashboardStore.getState()
    expect(before.isDirty).toBe(false)
    const initialPast = before.past.length

    useDashboardStore.getState().setNightTheme(NIGHT_THEME_PRESET)

    const after = useDashboardStore.getState()
    expect(after.isDirty).toBe(true)
    expect(after.past.length).toBe(initialPast + 1)
  })

  it('setNightTheme(null) clears the field', () => {
    useDashboardStore.getState().setNightTheme(NIGHT_THEME_PRESET)
    expect(useDashboardStore.getState().config?.nightTheme).toBeDefined()

    useDashboardStore.getState().setNightTheme(null)
    expect(useDashboardStore.getState().config?.nightTheme).toBeUndefined()
  })

  it('undo restores nightTheme to its previous value', () => {
    useDashboardStore.getState().setNightTheme(NIGHT_THEME_PRESET)
    const original = useDashboardStore.getState().config?.nightTheme

    useDashboardStore.getState().setNightTheme({
      bgColor: hex('#ABCDEF'),
      palette: { ...NIGHT_PALETTE_DEFAULT, primary: hex('#123456') },
    })
    expect(useDashboardStore.getState().config?.nightTheme?.bgColor).toBe('#ABCDEF')

    useDashboardStore.getState().undo()
    expect(useDashboardStore.getState().config?.nightTheme).toEqual(original)
  })

  it('setNightTheme(NIGHT_THEME_PRESET) lands the night defaults', () => {
    useDashboardStore.getState().setNightTheme(NIGHT_THEME_PRESET)
    const nightTheme = useDashboardStore.getState().config?.nightTheme
    expect(nightTheme?.bgColor).toBe(NIGHT_BG_DEFAULT)
    expect(nightTheme?.palette).toEqual(NIGHT_PALETTE_DEFAULT)
  })

  it('setDayTheme does not touch nightTheme (independent slots)', () => {
    useDashboardStore.getState().setNightTheme(NIGHT_THEME_PRESET)
    useDashboardStore.getState().setDayTheme(DAY_THEME_PRESET)

    const config = useDashboardStore.getState().config
    expect(config?.dayTheme).toEqual(DAY_THEME_PRESET)
    expect(config?.nightTheme).toEqual(NIGHT_THEME_PRESET)
  })
})

describe('dashboard.store — preset application (#21 v2)', () => {
  beforeEach(() => {
    useDashboardStore.getState().setConfig(freshConfig())
  })

  it.each(THEME_PRESETS.map((p) => [p.id] as const))(
    'applies preset %s to the day theme via setDayTheme',
    (id) => {
      const entry = getThemePreset(id)
      expect(entry).toBeDefined()
      if (!entry) return
      useDashboardStore.getState().setDayTheme(entry.theme)
      expect(useDashboardStore.getState().config?.dayTheme).toEqual(entry.theme)
    }
  )

  it.each(THEME_PRESETS.map((p) => [p.id] as const))(
    'applies preset %s to the night theme via setNightTheme',
    (id) => {
      const entry = getThemePreset(id)
      expect(entry).toBeDefined()
      if (!entry) return
      useDashboardStore.getState().setNightTheme(entry.theme)
      expect(useDashboardStore.getState().config?.nightTheme).toEqual(entry.theme)
    }
  )

  it('copy day → night replicates the current day theme into nightTheme', () => {
    const customDay = {
      bgColor: hex('#EEDDCC'),
      palette: { ...DAY_PALETTE_DEFAULT, primary: hex('#112233') },
    }
    useDashboardStore.getState().setDayTheme(customDay)
    // Simulate the ThemePanel's "Copy day → night" button
    const dayThemeNow = useDashboardStore.getState().config?.dayTheme
    expect(dayThemeNow).toBeDefined()
    if (dayThemeNow) {
      useDashboardStore.getState().setNightTheme({
        bgColor: dayThemeNow.bgColor,
        palette: dayThemeNow.palette,
      })
    }
    expect(useDashboardStore.getState().config?.nightTheme?.bgColor).toBe('#EEDDCC')
    expect(useDashboardStore.getState().config?.nightTheme?.palette?.primary).toBe('#112233')
  })
})

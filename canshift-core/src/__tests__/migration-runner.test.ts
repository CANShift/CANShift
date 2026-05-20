// migration-runner.test.ts

import {
  BUILTIN_MIGRATIONS,
  migrateConfig,
  validateMigrationChain,
} from '../migrations/migration-runner.js'
import type { MigrationRegistry } from '../migrations/migration-runner.js'
import { CURRENT_SCHEMA_VERSION } from '../index.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeButtonWidget(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'btn1',
    type: 'button',
    config: { label: 'Go', targetPageId: 'p2' },
    ...overrides,
  }
}

function makeLabelWidget(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'lbl1',
    type: 'label',
    config: { signalId: 'rpm', decimalPlaces: 1, suffix: ' rpm' },
    ...overrides,
  }
}

function makeGaugeWidget(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'g1',
    type: 'gauge',
    config: { signalId: 'rpm', minValue: 0, maxValue: 8000, warningLevel: 70, dangerLevel: 90 },
    ...overrides,
  }
}

function wrapInPages(widgets: Record<string, unknown>[]): Record<string, unknown>[] {
  return [{ id: 'p1', name: 'Main', widgets }]
}

// ---------------------------------------------------------------------------
// No-op: same version
// ---------------------------------------------------------------------------

describe('migrateConfig — no migration needed', () => {
  it('returns config unchanged when already at target version', () => {
    const config = { version: '1.2.0', name: 'Test', pages: [] }
    const result = migrateConfig(config, '1.2.0')
    expect(result.applied).toHaveLength(0)
    expect(result.config).toEqual(config)
  })
})

// ---------------------------------------------------------------------------
// 1.0.0 → 1.1.0: button targetPageId → actions array
// ---------------------------------------------------------------------------

describe('migrateConfig — 1.0.0 → 1.1.0', () => {
  it('converts button targetPageId to navigate action', () => {
    const config = {
      version: '1.0.0',
      pages: wrapInPages([makeButtonWidget()]),
    }
    const { config: out, applied } = migrateConfig(config, '1.1.0')
    expect(applied).toEqual(['1.0.0 → 1.1.0'])
    expect(out.version).toBe('1.1.0')

    const widgets = (out.pages as Record<string, unknown>[])[0]!.widgets as Record<
      string,
      unknown
    >[]
    const btn = widgets[0]!.config as Record<string, unknown>
    expect(btn['actions']).toEqual([{ category: 'dashboard', type: 'navigate', pageId: 'p2' }])
    expect('targetPageId' in btn).toBe(false)
  })

  it('leaves buttons with no targetPageId with an empty actions array', () => {
    const config = {
      version: '1.0.0',
      pages: wrapInPages([{ id: 'btn2', type: 'button', config: { label: 'Noop' } }]),
    }
    const { config: out } = migrateConfig(config, '1.1.0')
    const btn = (
      (out.pages as Record<string, unknown>[])[0]!.widgets as Record<string, unknown>[]
    )[0]!.config as Record<string, unknown>
    expect(btn['actions']).toEqual([])
  })

  it('does not touch buttons that already have actions', () => {
    const actions = [{ category: 'dashboard', type: 'navigate', pageId: 'p3' }]
    const config = {
      version: '1.0.0',
      pages: wrapInPages([{ id: 'btn3', type: 'button', config: { label: 'Go', actions } }]),
    }
    const { config: out } = migrateConfig(config, '1.1.0')
    const btn = (
      (out.pages as Record<string, unknown>[])[0]!.widgets as Record<string, unknown>[]
    )[0]!.config as Record<string, unknown>
    expect(btn['actions']).toEqual(actions)
  })

  it('does not modify non-button widgets', () => {
    const gauge = makeGaugeWidget()
    const config = { version: '1.0.0', pages: wrapInPages([gauge]) }
    const { config: out } = migrateConfig(config, '1.1.0')
    const w = (
      (out.pages as Record<string, unknown>[])[0]!.widgets as Record<string, unknown>[]
    )[0]!
    expect(w.type).toBe('gauge')
    expect((w.config as Record<string, unknown>)['actions']).toBeUndefined()
  })

  it('handles config with no pages', () => {
    const config = { version: '1.0.0' }
    const { config: out } = migrateConfig(config, '1.1.0')
    expect(out.version).toBe('1.1.0')
  })
})

// ---------------------------------------------------------------------------
// 1.1.0 → 1.2.0: label widgets → gauge + gauge gets displayStyle
// ---------------------------------------------------------------------------

describe('migrateConfig — 1.1.0 → 1.2.0', () => {
  it('converts label widget to gauge with displayStyle: numeric', () => {
    const config = {
      version: '1.1.0',
      pages: wrapInPages([makeLabelWidget()]),
    }
    const { config: out, applied } = migrateConfig(config, '1.2.0')
    expect(applied).toEqual(['1.1.0 → 1.2.0'])
    const w = (
      (out.pages as Record<string, unknown>[])[0]!.widgets as Record<string, unknown>[]
    )[0]!
    expect(w.type).toBe('gauge')
    const cfg = w.config as Record<string, unknown>
    expect(cfg['displayStyle']).toBe('numeric')
    expect(cfg['decimalPlaces']).toBe(1)
    expect(cfg['suffix']).toBe(' rpm')
  })

  it('adds displayStyle: arc to existing gauge widgets that lack it', () => {
    const config = {
      version: '1.1.0',
      pages: wrapInPages([makeGaugeWidget()]),
    }
    const { config: out } = migrateConfig(config, '1.2.0')
    const cfg = (
      (out.pages as Record<string, unknown>[])[0]!.widgets as Record<string, unknown>[]
    )[0]!.config as Record<string, unknown>
    expect(cfg['displayStyle']).toBe('arc')
  })

  it('does not overwrite existing displayStyle on gauge widgets', () => {
    const config = {
      version: '1.1.0',
      pages: wrapInPages([
        {
          ...makeGaugeWidget(),
          config: {
            ...(makeGaugeWidget().config as Record<string, unknown>),
            displayStyle: 'numeric',
          },
        },
      ]),
    }
    const { config: out } = migrateConfig(config, '1.2.0')
    const cfg = (
      (out.pages as Record<string, unknown>[])[0]!.widgets as Record<string, unknown>[]
    )[0]!.config as Record<string, unknown>
    expect(cfg['displayStyle']).toBe('numeric')
  })
})

// ---------------------------------------------------------------------------
// 1.0.0 → 1.2.0: full two-step chain
// ---------------------------------------------------------------------------

describe('migrateConfig — multi-step chain (1.0.0 → 1.2.0)', () => {
  it('applies both migrations in sequence', () => {
    const config = {
      version: '1.0.0',
      pages: wrapInPages([makeButtonWidget(), makeLabelWidget()]),
    }
    const { config: out, applied } = migrateConfig(config, '1.2.0')
    expect(applied).toEqual(['1.0.0 → 1.1.0', '1.1.0 → 1.2.0'])
    expect(out.version).toBe('1.2.0')

    const widgets = (out.pages as Record<string, unknown>[])[0]!.widgets as Record<
      string,
      unknown
    >[]

    // Button was migrated in 1.0.0→1.1.0
    const btn = widgets[0]!.config as Record<string, unknown>
    expect(btn['actions']).toBeDefined()

    // Label was migrated in 1.1.0→1.2.0
    expect(widgets[1]!.type).toBe('gauge')
  })
})

// ---------------------------------------------------------------------------
// 1.5.0 → 1.6.0: drop XS / S / M sizes — upgrade legacy small widgets to L
// ---------------------------------------------------------------------------

describe('migrateConfig — 1.5.0 → 1.6.0', () => {
  function makeStandardWidget(
    type: string,
    layout: { w: number; h: number }
  ): Record<string, unknown> {
    return {
      id: `${type}_1`,
      type,
      layout: { x: 0, y: 0, zOrder: 0, ...layout },
      config: { type },
    }
  }

  it('upgrades XS button (80×28) to L (160×56)', () => {
    const config = {
      version: '1.5.0',
      pages: wrapInPages([makeStandardWidget('button', { w: 80, h: 28 })]),
    }
    const { config: out, applied } = migrateConfig(config, '1.6.0')
    expect(applied).toEqual(['1.5.0 → 1.6.0'])
    const layout = (
      (out.pages as Record<string, unknown>[])[0]!.widgets as Record<string, unknown>[]
    )[0]!.layout as Record<string, number>
    expect(layout.w).toBe(160)
    expect(layout.h).toBe(56)
  })

  it('upgrades S warning (80×56) and M gear (80×112) to L', () => {
    const config = {
      version: '1.5.0',
      pages: wrapInPages([
        makeStandardWidget('warning', { w: 80, h: 56 }),
        makeStandardWidget('gear', { w: 80, h: 112 }),
      ]),
    }
    const { config: out } = migrateConfig(config, '1.6.0')
    const widgets = (out.pages as Record<string, unknown>[])[0]!.widgets as Record<
      string,
      unknown
    >[]
    for (const w of widgets) {
      const layout = w.layout as Record<string, number>
      expect(layout.w).toBe(160)
      expect(layout.h).toBe(56)
    }
  })

  it('does not touch already-large standard widgets (L / XL)', () => {
    const config = {
      version: '1.5.0',
      pages: wrapInPages([
        makeStandardWidget('button', { w: 160, h: 56 }),
        makeStandardWidget('warning', { w: 160, h: 112 }),
      ]),
    }
    const { config: out } = migrateConfig(config, '1.6.0')
    const widgets = (out.pages as Record<string, unknown>[])[0]!.widgets as Record<
      string,
      unknown
    >[]
    expect((widgets[0]!.layout as Record<string, number>).w).toBe(160)
    expect((widgets[0]!.layout as Record<string, number>).h).toBe(56)
    expect((widgets[1]!.layout as Record<string, number>).w).toBe(160)
    expect((widgets[1]!.layout as Record<string, number>).h).toBe(112)
  })

  it('leaves gauge widgets alone (they keep their narrow bar tokens)', () => {
    // A vertical bar gauge sized 40×112 (V-M) must not be touched by the
    // standard-widget migration. A vertical bar at 80×56 (legacy S vertical)
    // also stays — gauges are exempt from the L/XL collapse.
    const config = {
      version: '1.5.0',
      pages: wrapInPages([
        makeStandardWidget('gauge', { w: 40, h: 112 }),
        makeStandardWidget('gauge', { w: 80, h: 56 }),
      ]),
    }
    const { config: out } = migrateConfig(config, '1.6.0')
    const widgets = (out.pages as Record<string, unknown>[])[0]!.widgets as Record<
      string,
      unknown
    >[]
    expect((widgets[0]!.layout as Record<string, number>).w).toBe(40)
    expect((widgets[0]!.layout as Record<string, number>).h).toBe(112)
    expect((widgets[1]!.layout as Record<string, number>).w).toBe(80)
    expect((widgets[1]!.layout as Record<string, number>).h).toBe(56)
  })

  it('handles config with no pages', () => {
    const config = { version: '1.5.0' }
    const { config: out } = migrateConfig(config, '1.6.0')
    expect(out.version).toBe('1.6.0')
  })
})

// ---------------------------------------------------------------------------
// 1.6.0 → 1.7.0: drop unused page-level fields
// ---------------------------------------------------------------------------

describe('migrateConfig — 1.6.0 → 1.7.0', () => {
  it('drops page.name silently', () => {
    const config = {
      version: '1.6.0',
      pages: [{ id: 'p1', name: 'Main', widgets: [] }],
    }
    const { config: out, applied } = migrateConfig(config, '1.7.0')
    expect(applied).toEqual(['1.6.0 → 1.7.0'])
    const page = (out.pages as Record<string, unknown>[])[0]!
    expect('name' in page).toBe(false)
    expect(page.id).toBe('p1')
  })

  it('drops topBar.showMapName and topBar.showMapProfile silently', () => {
    const config = {
      version: '1.6.0',
      topBar: {
        height: 16,
        bgColor: '#000',
        textColor: '#FFF',
        showMapName: true,
        showMapProfile: false,
      },
    }
    const { config: out } = migrateConfig(config, '1.7.0')
    const topBar = out.topBar as Record<string, unknown>
    expect('showMapName' in topBar).toBe(false)
    expect('showMapProfile' in topBar).toBe(false)
    expect(topBar.height).toBe(16)
    expect(topBar.bgColor).toBe('#000')
  })

  it('preserves widgets and other page fields', () => {
    const widgets = [{ id: 'w1', type: 'gauge' }]
    const config = {
      version: '1.6.0',
      pages: [{ id: 'p1', name: 'Main', backgroundColor: '#111', widgets }],
    }
    const { config: out } = migrateConfig(config, '1.7.0')
    const page = (out.pages as Record<string, unknown>[])[0]!
    expect(page.widgets).toEqual(widgets)
    expect(page.backgroundColor).toBe('#111')
  })

  it('handles config with no topBar and no pages', () => {
    const config = { version: '1.6.0' }
    const { config: out } = migrateConfig(config, '1.7.0')
    expect(out.version).toBe('1.7.0')
  })
})

// ---------------------------------------------------------------------------
// 1.7.0 → 1.8.0: button colours, drop iconName from gauge/bar
// ---------------------------------------------------------------------------

describe('migrateConfig — 1.7.0 → 1.8.0', () => {
  function makeButton(
    overrides: Record<string, unknown> = {},
    style?: Record<string, unknown>
  ): Record<string, unknown> {
    return {
      id: 'btn1',
      type: 'button',
      style: style ?? { primaryColor: '#FF4444', textColor: '#FFFFFF' },
      config: { type: 'button', label: 'Go', actions: [] },
      ...overrides,
    }
  }

  it('populates button colors from style.primaryColor and brightens for active', () => {
    const config = {
      version: '1.7.0',
      pages: wrapInPages([makeButton({}, { primaryColor: '#CC3333' })]),
    }
    const { config: out, applied } = migrateConfig(config, '1.8.0')
    expect(applied).toEqual(['1.7.0 → 1.8.0'])
    const btnCfg = (
      (out.pages as Record<string, unknown>[])[0]!.widgets as Record<string, unknown>[]
    )[0]!.config as Record<string, unknown>
    const colors = btnCfg.colors as Record<string, string>
    expect(colors.normal).toBe('#CC3333')
    expect(colors.active).toBe('#FF6666')
  })

  it('falls back to default red when widget.style.primaryColor is missing', () => {
    const config = {
      version: '1.7.0',
      pages: wrapInPages([
        {
          id: 'btn1',
          type: 'button',
          config: { type: 'button', label: 'Go', actions: [] },
        },
      ]),
    }
    const { config: out } = migrateConfig(config, '1.8.0')
    const btnCfg = (
      (out.pages as Record<string, unknown>[])[0]!.widgets as Record<string, unknown>[]
    )[0]!.config as Record<string, unknown>
    const colors = btnCfg.colors as Record<string, string>
    expect(colors.normal).toBe('#FF4444')
    expect(colors.active).toBe('#FF7777')
  })

  it('does not overwrite existing button colors', () => {
    const existingColors = { normal: '#0000FF', active: '#3333FF' }
    const config = {
      version: '1.7.0',
      pages: wrapInPages([
        makeButton({
          config: { type: 'button', label: 'Go', actions: [], colors: existingColors },
        }),
      ]),
    }
    const { config: out } = migrateConfig(config, '1.8.0')
    const btnCfg = (
      (out.pages as Record<string, unknown>[])[0]!.widgets as Record<string, unknown>[]
    )[0]!.config as Record<string, unknown>
    expect(btnCfg.colors).toEqual(existingColors)
  })

  it('drops iconName from gauge configs', () => {
    const config = {
      version: '1.7.0',
      pages: wrapInPages([
        {
          id: 'g1',
          type: 'gauge',
          config: { type: 'gauge', iconName: 'rpm', minValue: 0, maxValue: 100 },
        },
      ]),
    }
    const { config: out } = migrateConfig(config, '1.8.0')
    const cfg = (
      (out.pages as Record<string, unknown>[])[0]!.widgets as Record<string, unknown>[]
    )[0]!.config as Record<string, unknown>
    expect('iconName' in cfg).toBe(false)
    expect(cfg.minValue).toBe(0)
  })

  it('drops iconName from bar configs', () => {
    const config = {
      version: '1.7.0',
      pages: wrapInPages([
        {
          id: 'b1',
          type: 'bar',
          config: { type: 'bar', iconName: 'rpm', decimalPlaces: 0 },
        },
      ]),
    }
    const { config: out } = migrateConfig(config, '1.8.0')
    const cfg = (
      (out.pages as Record<string, unknown>[])[0]!.widgets as Record<string, unknown>[]
    )[0]!.config as Record<string, unknown>
    expect('iconName' in cfg).toBe(false)
  })

  it('keeps iconName on warning widgets', () => {
    const config = {
      version: '1.7.0',
      pages: wrapInPages([
        {
          id: 'w1',
          type: 'warning',
          config: { type: 'warning', iconName: 'warning', threshold: 0.5 },
        },
      ]),
    }
    const { config: out } = migrateConfig(config, '1.8.0')
    const cfg = (
      (out.pages as Record<string, unknown>[])[0]!.widgets as Record<string, unknown>[]
    )[0]!.config as Record<string, unknown>
    expect(cfg.iconName).toBe('warning')
  })
})

// ---------------------------------------------------------------------------
// 1.8.0 → 1.9.0: H-FULL bar gauge token doubled (320×28 → 320×56)
// ---------------------------------------------------------------------------

describe('migrateConfig — 1.8.0 → 1.9.0', () => {
  function makeHorizontalBar(layout: Record<string, unknown>): Record<string, unknown> {
    return {
      id: 'tps',
      type: 'gauge',
      layout,
      config: {
        type: 'gauge',
        displayStyle: 'bar',
        barOrientation: 'horizontal',
        minValue: 0,
        maxValue: 100,
      },
    }
  }

  it('upgrades horizontal bar gauges from 320×28 to 320×56', () => {
    const config = {
      version: '1.8.0',
      pages: wrapInPages([makeHorizontalBar({ x: 0, y: 168, w: 320, h: 28, zOrder: 0 })]),
    }
    const { config: out, applied } = migrateConfig(config, '1.9.0')
    expect(applied).toEqual(['1.8.0 → 1.9.0'])
    const layout = (
      (out.pages as Record<string, unknown>[])[0]!.widgets as Record<string, unknown>[]
    )[0]!.layout as Record<string, unknown>
    expect(layout.h).toBe(56)
    expect(layout.w).toBe(320)
  })

  it('leaves bars at the new height untouched', () => {
    const config = {
      version: '1.8.0',
      pages: wrapInPages([makeHorizontalBar({ x: 0, y: 168, w: 320, h: 56, zOrder: 0 })]),
    }
    const { config: out } = migrateConfig(config, '1.9.0')
    const layout = (
      (out.pages as Record<string, unknown>[])[0]!.widgets as Record<string, unknown>[]
    )[0]!.layout as Record<string, unknown>
    expect(layout.h).toBe(56)
  })

  it('does not touch vertical bars (V / V-M)', () => {
    const config = {
      version: '1.8.0',
      pages: wrapInPages([
        {
          id: 'rpm_v',
          type: 'gauge',
          layout: { x: 0, y: 0, w: 40, h: 224, zOrder: 0 },
          config: {
            type: 'gauge',
            displayStyle: 'bar',
            barOrientation: 'vertical',
            minValue: 0,
            maxValue: 8000,
          },
        },
      ]),
    }
    const { config: out } = migrateConfig(config, '1.9.0')
    const layout = (
      (out.pages as Record<string, unknown>[])[0]!.widgets as Record<string, unknown>[]
    )[0]!.layout as Record<string, unknown>
    expect(layout.h).toBe(224)
  })

  it('does not touch numeric or arc gauges sized 320×28', () => {
    const config = {
      version: '1.8.0',
      pages: wrapInPages([
        {
          id: 'fuel',
          type: 'gauge',
          layout: { x: 0, y: 196, w: 320, h: 28, zOrder: 0 },
          config: { type: 'gauge', displayStyle: 'numeric', minValue: 0, maxValue: 6 },
        },
      ]),
    }
    const { config: out } = migrateConfig(config, '1.9.0')
    const layout = (
      (out.pages as Record<string, unknown>[])[0]!.widgets as Record<string, unknown>[]
    )[0]!.layout as Record<string, unknown>
    expect(layout.h).toBe(28)
  })
})

// ---------------------------------------------------------------------------
// 1.9.0 → 1.10.0: alertThreshold added to gauge / bar widget configs
// ---------------------------------------------------------------------------

describe('migrateConfig — 1.9.0 → 1.10.0', () => {
  it('bumps version with no data transformation', () => {
    const config = {
      version: '1.9.0',
      pages: wrapInPages([
        {
          id: 'g1',
          type: 'gauge',
          config: { type: 'gauge', displayStyle: 'arc', minValue: 0, maxValue: 100 },
        },
      ]),
    }
    const { config: out, applied } = migrateConfig(config, '1.10.0')
    expect(applied).toEqual(['1.9.0 → 1.10.0'])
    expect(out.version).toBe('1.10.0')
    const cfg = (
      (out.pages as Record<string, unknown>[])[0]!.widgets as Record<string, unknown>[]
    )[0]!.config as Record<string, unknown>
    expect(cfg.alertThreshold).toBeUndefined()
  })

  it('preserves an explicit alertThreshold through the bump', () => {
    const config = {
      version: '1.9.0',
      pages: wrapInPages([
        {
          id: 'g1',
          type: 'gauge',
          config: {
            type: 'gauge',
            displayStyle: 'arc',
            minValue: 0,
            maxValue: 8000,
            alertThreshold: 7200,
          },
        },
      ]),
    }
    const { config: out } = migrateConfig(config, '1.10.0')
    const cfg = (
      (out.pages as Record<string, unknown>[])[0]!.widgets as Record<string, unknown>[]
    )[0]!.config as Record<string, unknown>
    expect(cfg.alertThreshold).toBe(7200)
  })
})

// ---------------------------------------------------------------------------
// 1.10.0 → 1.11.0: arc gauges gain an optional `arcFillStyle` field
// ---------------------------------------------------------------------------

describe('migrateConfig — 1.10.0 → 1.11.0', () => {
  it('bumps version with no data transformation', () => {
    const config = {
      version: '1.10.0',
      pages: wrapInPages([
        {
          id: 'g1',
          type: 'gauge',
          config: { type: 'gauge', displayStyle: 'arc', minValue: 0, maxValue: 100 },
        },
      ]),
    }
    const { config: out, applied } = migrateConfig(config, '1.11.0')
    expect(applied).toEqual(['1.10.0 → 1.11.0'])
    expect(out.version).toBe('1.11.0')
    const cfg = (
      (out.pages as Record<string, unknown>[])[0]!.widgets as Record<string, unknown>[]
    )[0]!.config as Record<string, unknown>
    // No defaulting on the migration side — undefined stays undefined.
    expect(cfg.arcFillStyle).toBeUndefined()
    // Existing fields are preserved.
    expect(cfg.displayStyle).toBe('arc')
    expect(cfg.minValue).toBe(0)
    expect(cfg.maxValue).toBe(100)
  })

  it('preserves an explicit arcFillStyle through the bump', () => {
    const config = {
      version: '1.10.0',
      pages: wrapInPages([
        {
          id: 'g1',
          type: 'gauge',
          config: {
            type: 'gauge',
            displayStyle: 'arc',
            minValue: 0,
            maxValue: 8000,
            arcFillStyle: 'gradient',
          },
        },
      ]),
    }
    const { config: out } = migrateConfig(config, '1.11.0')
    const cfg = (
      (out.pages as Record<string, unknown>[])[0]!.widgets as Record<string, unknown>[]
    )[0]!.config as Record<string, unknown>
    expect(cfg.arcFillStyle).toBe('gradient')
  })

  it('preserves other widget fields and top-level config keys', () => {
    const config = {
      version: '1.10.0',
      name: 'My Dashboard',
      revLimitRpm: 7000,
      pages: wrapInPages([
        {
          id: 'g1',
          type: 'gauge',
          config: {
            type: 'gauge',
            displayStyle: 'arc',
            minValue: 0,
            maxValue: 100,
            alertThreshold: 90,
          },
        },
      ]),
    }
    const { config: out } = migrateConfig(config, '1.11.0')
    expect(out.name).toBe('My Dashboard')
    expect(out.revLimitRpm).toBe(7000)
    const cfg = (
      (out.pages as Record<string, unknown>[])[0]!.widgets as Record<string, unknown>[]
    )[0]!.config as Record<string, unknown>
    expect(cfg.alertThreshold).toBe(90)
  })
})

// ---------------------------------------------------------------------------
// Full chain regression — load a 1.0.0 config and walk it to the latest
// schema. Guards against silent breakage of the chain when adding migrations.
// ---------------------------------------------------------------------------

describe('migrateConfig — full chain to current', () => {
  // Rebuild the expected `applied` list from BUILTIN_MIGRATIONS so the
  // regression test always walks every registered step up to
  // CURRENT_SCHEMA_VERSION. BUILTIN_MIGRATIONS is registered newest-first;
  // reverse to walk forward through history.
  const expectedApplied = [...BUILTIN_MIGRATIONS]
    .reverse()
    .map((m) => `${m.fromVersion} → ${m.toVersion}`)

  it(`walks a 1.0.0 config all the way to ${CURRENT_SCHEMA_VERSION} without losing data`, () => {
    const config = {
      version: '1.0.0',
      defaultPageId: 'p1',
      revLimitRpm: 7000,
      topBar: {
        height: 16,
        bgColor: '#0D0D0D',
        textColor: '#AAAAAA',
        showMapName: true, // dropped in 1.6→1.7
      },
      pages: [
        {
          id: 'p1',
          name: 'Main', // dropped in 1.6→1.7
          showTopBar: true,
          backgroundColor: '#000000',
          widgets: [
            // Button — gains `actions` in 1.0→1.1, then `colors` in 1.7→1.8
            {
              id: 'btn1',
              type: 'button',
              style: { primaryColor: '#CC3333', textColor: '#FFFFFF' },
              config: { type: 'button', label: 'Engine', targetPageId: 'p2' },
            },
            // Label — becomes a numeric gauge in 1.1→1.2
            {
              id: 'lbl1',
              type: 'label',
              config: { signalId: 'rpm', decimalPlaces: 0, suffix: ' rpm' },
            },
            // Standard widget at legacy 80×56 — collapsed to 160×56 in 1.5→1.6
            {
              id: 'gear1',
              type: 'gear',
              layout: { x: 0, y: 0, w: 80, h: 56, zOrder: 0 },
              config: { type: 'gear', decimalPlaces: 0 },
            },
            // Horizontal bar gauge at the legacy 320×28 — doubled to 320×56 in 1.8→1.9
            {
              id: 'tps_bar',
              type: 'gauge',
              layout: { x: 0, y: 196, w: 320, h: 28, zOrder: 0 },
              style: { primaryColor: '#FF4444' },
              config: {
                type: 'gauge',
                displayStyle: 'bar',
                barOrientation: 'horizontal',
                minValue: 0,
                maxValue: 100,
                warningLevel: 70, // dropped in 1.16→1.17
                dangerLevel: 90,
              },
            },
          ],
        },
      ],
    }

    const { config: out, applied } = migrateConfig(config, CURRENT_SCHEMA_VERSION)
    expect(out.version).toBe(CURRENT_SCHEMA_VERSION)
    expect(applied).toEqual(expectedApplied)

    const page = (out.pages as Record<string, unknown>[])[0]!
    expect(page.name).toBeUndefined() // dropped in 1.6→1.7
    expect(page.palette).toBeDefined() // added in 1.2→1.3

    const topBar = out.topBar as Record<string, unknown>
    expect(topBar.showMapName).toBeUndefined() // dropped in 1.6→1.7

    const widgets = page.widgets as Record<string, unknown>[]

    // Button: gained colors block, kept its label
    const btn = widgets[0]!
    expect((btn.config as Record<string, unknown>).colors).toBeDefined()

    // Label widget became a numeric gauge
    const lbl = widgets[1]!
    expect(lbl.type).toBe('gauge')

    // Gear at 80×56 was collapsed to 160×56
    const gear = widgets[2]!
    const gearLayout = gear.layout as Record<string, unknown>
    expect(gearLayout.w).toBe(160)
    expect(gearLayout.h).toBe(56)

    // Horizontal bar at 320×28 was doubled to 320×56; warningLevel dropped in 1.16→1.17
    const tps = widgets[3]!
    const tpsLayout = tps.layout as Record<string, unknown>
    expect(tpsLayout.w).toBe(320)
    expect(tpsLayout.h).toBe(56)
    const tpsCfg = tps.config as Record<string, unknown>
    expect('warningLevel' in tpsCfg).toBe(false)
    expect(tpsCfg.dangerLevel).toBe(90)
  })

  it(`a fresh ${CURRENT_SCHEMA_VERSION} config is a no-op through the runner`, () => {
    const config = {
      version: CURRENT_SCHEMA_VERSION,
      pages: [{ id: 'p1', widgets: [] }],
    }
    const { config: out, applied } = migrateConfig(config, CURRENT_SCHEMA_VERSION)
    expect(applied).toEqual([])
    expect(out).toEqual(config)
  })
})

// ---------------------------------------------------------------------------
// 1.13.0 → 1.14.0: signals.json protocol field migrated away from
// MaxxECU-specific identifier (issue #639)
// ---------------------------------------------------------------------------

describe('migrateConfig — 1.13.0 → 1.14.0', () => {
  it('rewrites legacy "maxxecu_v1.2" protocol to "custom_v1.0"', () => {
    const config = {
      version: '1.13.0',
      protocol: 'maxxecu_v1.2',
      canSpeedKbps: 500,
      signals: [],
    }
    const { config: out, applied } = migrateConfig(config, '1.14.0')
    expect(applied).toEqual(['1.13.0 → 1.14.0'])
    expect(out.version).toBe('1.14.0')
    expect(out.protocol).toBe('custom_v1.0')
    expect(out.canSpeedKbps).toBe(500)
  })

  it('leaves a custom protocol value untouched', () => {
    const config = {
      version: '1.13.0',
      protocol: 'my_ecu_v2',
      canSpeedKbps: 1000,
      signals: [],
    }
    const { config: out } = migrateConfig(config, '1.14.0')
    expect(out.version).toBe('1.14.0')
    expect(out.protocol).toBe('my_ecu_v2')
  })

  it('is a safe no-op on dashboard configs (no protocol field)', () => {
    const config = {
      version: '1.13.0',
      name: 'Dash',
      pages: [{ id: 'p1', widgets: [] }],
    }
    const { config: out } = migrateConfig(config, '1.14.0')
    expect(out.version).toBe('1.14.0')
    expect(out.protocol).toBeUndefined()
    expect(out.name).toBe('Dash')
  })
})

// ---------------------------------------------------------------------------
// 1.12.0 → 1.13.0: SignalDef gains optional colorRamp (issue #430)
// ---------------------------------------------------------------------------

describe('migrateConfig — 1.12.0 → 1.13.0', () => {
  it('bumps the version on a config without any explicit ramps', () => {
    const config = { version: '1.12.0', name: 'Plain', pages: [] }
    const { config: out, applied } = migrateConfig(config, '1.13.0')
    expect(applied).toEqual(['1.12.0 → 1.13.0'])
    expect(out.version).toBe('1.13.0')
    expect(out.name).toBe('Plain')
  })

  it('preserves an explicit colorRamp on a signal definition', () => {
    const ramp = {
      interpolate: 'linear',
      stops: [
        { value: 0, color: '#44CC66' },
        { value: 100, color: '#CC3333' },
      ],
    }
    const config = {
      version: '1.12.0',
      signals: [{ name: 'rpm', colorRamp: ramp }],
    }
    const { config: out } = migrateConfig(config, '1.13.0')
    expect(out.version).toBe('1.13.0')
    expect((out.signals as Record<string, unknown>[])[0]?.colorRamp).toEqual(ramp)
  })

  it('walks 1.11.0 → 1.13.0 through the chain', () => {
    const config = { version: '1.11.0', topBar: { height: 30 } }
    const { applied } = migrateConfig(config, '1.13.0')
    expect(applied).toEqual(['1.11.0 → 1.12.0', '1.12.0 → 1.13.0'])
  })
})

// ---------------------------------------------------------------------------
// 1.11.0 → 1.12.0: bump default topBar.height 24 → 30 (issue #379)
// ---------------------------------------------------------------------------

describe('migrateConfig — 1.11.0 → 1.12.0', () => {
  it('rewrites topBar.height from the previous default 24 to 30', () => {
    const config = {
      version: '1.11.0',
      topBar: { height: 24, bgColor: '#0D0D0D', textColor: '#AAAAAA' },
    }
    const { config: out, applied } = migrateConfig(config, '1.12.0')
    expect(applied).toEqual(['1.11.0 → 1.12.0'])
    const topBar = out.topBar as Record<string, unknown>
    expect(topBar.height).toBe(30)
    expect(topBar.bgColor).toBe('#0D0D0D')
    expect(topBar.textColor).toBe('#AAAAAA')
    expect(out.version).toBe('1.12.0')
  })

  it('preserves a custom topBar.height that does not match the previous default', () => {
    const config = {
      version: '1.11.0',
      topBar: { height: 16, bgColor: '#000', textColor: '#FFF' },
    }
    const { config: out } = migrateConfig(config, '1.12.0')
    const topBar = out.topBar as Record<string, unknown>
    expect(topBar.height).toBe(16)
    expect(out.version).toBe('1.12.0')
  })

  it('preserves a topBar.height already bumped to 30', () => {
    const config = {
      version: '1.11.0',
      topBar: { height: 30 },
    }
    const { config: out } = migrateConfig(config, '1.12.0')
    const topBar = out.topBar as Record<string, unknown>
    expect(topBar.height).toBe(30)
  })

  it('handles a config without a topBar block', () => {
    const config = { version: '1.11.0', pages: [] }
    const { config: out } = migrateConfig(config, '1.12.0')
    expect(out.version).toBe('1.12.0')
    expect(out.topBar).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// 1.16.0 → 1.17.0: collapse gauge/bar thresholds — drop warningLevel
// ---------------------------------------------------------------------------

describe('migrateConfig — 1.16.0 → 1.17.0', () => {
  it('drops warningLevel from gauge configs and keeps dangerLevel', () => {
    const config = {
      version: '1.16.0',
      pages: wrapInPages([
        {
          id: 'g1',
          type: 'gauge',
          config: {
            type: 'gauge',
            displayStyle: 'arc',
            minValue: 0,
            maxValue: 100,
            warningLevel: 70,
            dangerLevel: 90,
            decimalPlaces: 0,
          },
        },
      ]),
    }
    const { config: out, applied } = migrateConfig(config, '1.17.0')
    expect(applied).toEqual(['1.16.0 → 1.17.0'])
    const cfg = (
      (out.pages as Record<string, unknown>[])[0]!.widgets as Record<string, unknown>[]
    )[0]!.config as Record<string, unknown>
    expect('warningLevel' in cfg).toBe(false)
    expect(cfg.dangerLevel).toBe(90)
    expect(cfg.minValue).toBe(0)
    expect(cfg.maxValue).toBe(100)
  })

  it('drops warningLevel from bar configs and keeps dangerLevel', () => {
    const config = {
      version: '1.16.0',
      pages: wrapInPages([
        {
          id: 'b1',
          type: 'bar',
          config: {
            type: 'bar',
            decimalPlaces: 0,
            warningLevel: 60,
            dangerLevel: 80,
          },
        },
      ]),
    }
    const { config: out } = migrateConfig(config, '1.17.0')
    const cfg = (
      (out.pages as Record<string, unknown>[])[0]!.widgets as Record<string, unknown>[]
    )[0]!.config as Record<string, unknown>
    expect('warningLevel' in cfg).toBe(false)
    expect(cfg.dangerLevel).toBe(80)
  })

  it('leaves widgets without warningLevel untouched', () => {
    const config = {
      version: '1.16.0',
      pages: wrapInPages([
        {
          id: 'g1',
          type: 'gauge',
          config: {
            type: 'gauge',
            displayStyle: 'arc',
            minValue: 0,
            maxValue: 100,
            dangerLevel: 90,
            decimalPlaces: 0,
          },
        },
      ]),
    }
    const { config: out } = migrateConfig(config, '1.17.0')
    const cfg = (
      (out.pages as Record<string, unknown>[])[0]!.widgets as Record<string, unknown>[]
    )[0]!.config as Record<string, unknown>
    expect(cfg.dangerLevel).toBe(90)
    expect(out.version).toBe('1.17.0')
  })

  it('handles a config without pages', () => {
    const config = { version: '1.16.0', name: 'no-pages' }
    const { config: out } = migrateConfig(config, '1.17.0')
    expect(out.version).toBe('1.17.0')
  })
})

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

describe('migrateConfig — error cases', () => {
  it('throws when no migration path exists', () => {
    const config = { version: '0.5.0' }
    expect(() => migrateConfig(config, '1.2.0')).toThrow()
  })

  it('throws with "Migration chain incomplete" when chain has gaps', () => {
    const config = { version: '0.5.0' }
    expect(() => migrateConfig(config, '1.2.0')).toThrow(/Migration chain incomplete/)
  })
})

// ---------------------------------------------------------------------------
// validateMigrationChain
// ---------------------------------------------------------------------------

describe('validateMigrationChain', () => {
  const identity = (c: Record<string, unknown>): Record<string, unknown> => c

  it('returns empty array when the full chain is present', () => {
    const registry: MigrationRegistry = [
      { fromVersion: '1.0.0', toVersion: '1.1.0', migrate: identity },
      { fromVersion: '1.1.0', toVersion: '1.2.0', migrate: identity },
    ]
    expect(validateMigrationChain('1.0.0', '1.2.0', registry)).toEqual([])
  })

  it('returns empty array when fromVersion equals toVersion', () => {
    const registry: MigrationRegistry = []
    expect(validateMigrationChain('1.0.0', '1.0.0', registry)).toEqual([])
  })

  it('returns missing step when a single step is absent', () => {
    const registry: MigrationRegistry = [
      { fromVersion: '1.0.0', toVersion: '1.1.0', migrate: identity },
      // 1.1.0 → 1.2.0 is missing
    ]
    const missing = validateMigrationChain('1.0.0', '1.2.0', registry)
    expect(missing.length).toBeGreaterThan(0)
    expect(missing.some((s) => s.includes('1.1.0'))).toBe(true)
  })

  it('returns a missing step when registry is empty', () => {
    const registry: MigrationRegistry = []
    const missing = validateMigrationChain('1.0.0', '1.2.0', registry)
    expect(missing.length).toBeGreaterThan(0)
  })

  it('works with a single-step chain', () => {
    const registry: MigrationRegistry = [
      { fromVersion: '1.0.0', toVersion: '1.1.0', migrate: identity },
    ]
    expect(validateMigrationChain('1.0.0', '1.1.0', registry)).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Anchor: BUILTIN_MIGRATIONS terminates at CURRENT_SCHEMA_VERSION
// ---------------------------------------------------------------------------
//
// These tests fail fast at build/test time when CURRENT_SCHEMA_VERSION is
// bumped without adding the matching migration entry, instead of failing at
// runtime when a user opens an old config.

describe('BUILTIN_MIGRATIONS chain anchor', () => {
  it('is non-empty', () => {
    expect(BUILTIN_MIGRATIONS.length).toBeGreaterThan(0)
  })

  it('forms a contiguous chain (every toVersion is the next fromVersion)', () => {
    // Walk the chain in registration order. Each migration's `to` must equal
    // the next migration's `from`. Order in the source file is descending
    // (newest first), so we reverse to walk forward through history.
    const ordered = [...BUILTIN_MIGRATIONS].reverse()
    for (let i = 0; i < ordered.length - 1; i += 1) {
      const current = ordered[i]
      const next = ordered[i + 1]
      expect(current).toBeDefined()
      expect(next).toBeDefined()
      expect(next!.fromVersion).toBe(current!.toVersion)
    }
  })

  it('terminates at CURRENT_SCHEMA_VERSION', () => {
    const ordered = [...BUILTIN_MIGRATIONS].reverse()
    const terminal = ordered[ordered.length - 1]
    expect(terminal).toBeDefined()
    expect(terminal!.toVersion).toBe(CURRENT_SCHEMA_VERSION)
  })

  it('validateMigrationChain reports no gaps from earliest fromVersion to CURRENT_SCHEMA_VERSION', () => {
    const ordered = [...BUILTIN_MIGRATIONS].reverse()
    const earliest = ordered[0]
    expect(earliest).toBeDefined()
    const missing = validateMigrationChain(earliest!.fromVersion, CURRENT_SCHEMA_VERSION, [
      ...BUILTIN_MIGRATIONS,
    ])
    expect(missing).toEqual([])
  })

  it('every entry has unique fromVersion (no forks in the chain)', () => {
    const seen = new Set<string>()
    for (const m of BUILTIN_MIGRATIONS) {
      expect(seen.has(m.fromVersion)).toBe(false)
      seen.add(m.fromVersion)
    }
  })
})

// ---------------------------------------------------------------------------
// migrateConfig deep-clones its input
// ---------------------------------------------------------------------------

describe('migrateConfig — input isolation', () => {
  it('does not mutate nested objects on the caller', () => {
    const page = { id: 'p1', widgets: [] as Record<string, unknown>[] }
    const config = { version: '1.4.0', pages: [page] }
    const snapshot = JSON.parse(JSON.stringify(config)) as typeof config

    migrateConfig(config, '1.5.0')

    expect(config).toEqual(snapshot)
    expect(config.pages[0]).toBe(page) // caller still owns the same reference
    expect(page.widgets).toEqual([])
  })

  it('returned config is independent of the input', () => {
    const config = { version: '1.4.0', pages: [{ id: 'p1', widgets: [] }] }
    const { config: out } = migrateConfig(config, '1.5.0')
    expect(out).not.toBe(config)
    expect((out as { pages: unknown[] }).pages).not.toBe(config.pages)
  })
})

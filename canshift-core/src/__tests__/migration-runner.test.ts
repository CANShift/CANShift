// migration-runner.test.ts

import { migrateConfig, validateMigrationChain } from '../migrations/migration-runner.js'
import type { MigrationRegistry } from '../migrations/migration-runner.js'

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

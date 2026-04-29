// migration-runner.test.ts

import { migrateConfig } from '../migrations/migration-runner.js'

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
// Error cases
// ---------------------------------------------------------------------------

describe('migrateConfig — error cases', () => {
  it('throws when no migration path exists', () => {
    const config = { version: '0.5.0' }
    expect(() => migrateConfig(config, '1.2.0')).toThrow(/No migration path/)
  })
})

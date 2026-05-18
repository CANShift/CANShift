// validate-dashboard.test.ts
//
// Issue #874: structural / shape validation now lives in
// `DashboardConfigSchema` (covered by `schemas.test.ts`). This file only
// tests the cross-document concerns that Zod cannot express on its own:
// `defaultPageId` visibility, id uniqueness, signal cross-reference warnings,
// and signal-catalog pass-through.

import { FIRMWARE_CAPS } from '../constants/firmware-caps.js'
import type { SignalConfig } from '../types/signal.js'
import { validateDashboard } from '../validation/validate-dashboard.js'

// ---------------------------------------------------------------------------
// Fixtures — full Zod-valid shapes; tests apply targeted mutations.
// ---------------------------------------------------------------------------

const VALID_STYLE = {
  primaryColor: '#FFFFFF',
  secondaryColor: '#2A2A2A',
  warningColor: '#FF8800',
  criticalColor: '#FF4444',
  textColor: '#FFFFFF',
  fontSize: 14,
} as const

const VALID_TOPBAR = {
  height: 16,
  bgColor: '#0D0D0D',
  textColor: '#AAAAAA',
} as const

function gaugeWidget(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'w0',
    type: 'gauge',
    signal: 'rpm',
    layout: { x: 0, y: 0, w: 80, h: 40, zOrder: 0 },
    style: VALID_STYLE,
    config: {
      type: 'gauge',
      displayStyle: 'arc',
      minValue: 0,
      maxValue: 8000,
      warningLevel: 6500,
      dangerLevel: 7500,
      decimalPlaces: 0,
    },
    ...overrides,
  }
}

function validPage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'p1',
    backgroundImage: null,
    backgroundColor: '#000000',
    showTopBar: true,
    widgets: [gaugeWidget()],
    ...overrides,
  }
}

function validConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: '1.15.0',
    name: 'Test Dashboard',
    defaultPageId: 'p1',
    revLimitRpm: 7000,
    topBar: { ...VALID_TOPBAR },
    pages: [validPage()],
    ...overrides,
  }
}

function signalCatalog(names: string[]): SignalConfig {
  return {
    version: '1.15.0',
    protocol: 'custom_v1.0',
    canSpeedKbps: 500,
    signals: names.map((name) => ({
      name,
      canFrameId: '0x100',
      startByte: 0,
      byteLength: 2,
      bigEndian: false,
      signed: false,
      scale: 1,
      offset: 0,
      unit: '',
      min: 0,
      max: 100,
      timeoutMs: 1000,
    })),
  }
}

// ---------------------------------------------------------------------------
// Smoke + return shape
// ---------------------------------------------------------------------------

describe('validateDashboard — return shape', () => {
  it('accepts a minimal valid config', () => {
    const result = validateDashboard(validConfig())
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('rejects non-object input', () => {
    for (const bad of [null, 42, 'string', undefined, []]) {
      expect(validateDashboard(bad).valid).toBe(false)
    }
  })

  it('returns { valid: false, errors[], warnings[] } on failure', () => {
    const result = validateDashboard({})
    expect(result.valid).toBe(false)
    expect(Array.isArray(result.errors)).toBe(true)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(Array.isArray(result.warnings)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Cross-field — defaultPageId visibility
// ---------------------------------------------------------------------------

describe('validateDashboard — defaultPageId', () => {
  it('rejects defaultPageId that does not match any page id', () => {
    const result = validateDashboard(validConfig({ defaultPageId: 'missing' }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('does not match any page id'))).toBe(true)
  })

  it('rejects defaultPageId that points to a hidden page', () => {
    const result = validateDashboard(
      validConfig({
        defaultPageId: 'hidden',
        pages: [validPage({ id: 'hidden', visible: false })],
      })
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('visible is false'))).toBe(true)
  })

  it('accepts defaultPageId pointing to a visible page', () => {
    const result = validateDashboard(
      validConfig({
        defaultPageId: 'visible',
        pages: [validPage({ id: 'visible', visible: true })],
      })
    )
    expect(result.valid).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Cross-field — id uniqueness
// ---------------------------------------------------------------------------

describe('validateDashboard — id uniqueness', () => {
  it('rejects duplicate page ids', () => {
    const result = validateDashboard(
      validConfig({
        defaultPageId: 'p1',
        pages: [validPage({ id: 'p1' }), validPage({ id: 'p1' })],
      })
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('duplicate page id'))).toBe(true)
  })

  it('rejects duplicate widget ids within a page', () => {
    const result = validateDashboard(
      validConfig({
        pages: [
          validPage({
            widgets: [gaugeWidget({ id: 'wDup' }), gaugeWidget({ id: 'wDup' })],
          }),
        ],
      })
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('duplicate widget id'))).toBe(true)
  })

  it('accepts the same widget id across different pages', () => {
    const result = validateDashboard(
      validConfig({
        pages: [
          validPage({ id: 'p1', widgets: [gaugeWidget({ id: 'shared' })] }),
          validPage({ id: 'p2', widgets: [gaugeWidget({ id: 'shared' })] }),
        ],
      })
    )
    expect(result.valid).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Cross-field — firmware caps
// ---------------------------------------------------------------------------

describe('validateDashboard — firmware caps', () => {
  it('rejects more than MAX_PAGES', () => {
    const pages = Array.from({ length: FIRMWARE_CAPS.MAX_PAGES + 1 }, (_, i) =>
      validPage({ id: `p${String(i)}` })
    )
    const result = validateDashboard(validConfig({ defaultPageId: 'p0', pages }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('pages'))).toBe(true)
  })

  it('accepts exactly MAX_PAGES', () => {
    const pages = Array.from({ length: FIRMWARE_CAPS.MAX_PAGES }, (_, i) =>
      validPage({ id: `p${String(i)}` })
    )
    const result = validateDashboard(validConfig({ defaultPageId: 'p0', pages }))
    expect(result.valid).toBe(true)
  })

  it('rejects more than MAX_WIDGETS_PER_PAGE', () => {
    const widgets = Array.from({ length: FIRMWARE_CAPS.MAX_WIDGETS_PER_PAGE + 1 }, (_, i) =>
      gaugeWidget({ id: `w${String(i)}`, layout: { x: 0, y: 0, w: 1, h: 1, zOrder: i } })
    )
    const result = validateDashboard(validConfig({ pages: [validPage({ widgets })] }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.toLowerCase().includes('widgets'))).toBe(true)
  })

  it('rejects topBar.layout exceeding MAX_TOPBAR_ITEMS', () => {
    const layout = Array.from({ length: FIRMWARE_CAPS.MAX_TOPBAR_ITEMS + 1 }, () => ({
      type: 'usbIcon',
      position: 'right',
    }))
    const result = validateDashboard(validConfig({ topBar: { ...VALID_TOPBAR, layout } }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.toLowerCase().includes('topbar'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Cross-field — gauge / bar threshold + range refinements
// ---------------------------------------------------------------------------

describe('validateDashboard — gauge cross-field', () => {
  it('rejects minValue >= maxValue', () => {
    const w = gaugeWidget({
      config: {
        type: 'gauge',
        displayStyle: 'arc',
        minValue: 100,
        maxValue: 50,
        warningLevel: 60,
        dangerLevel: 80,
        decimalPlaces: 0,
      },
    })
    const result = validateDashboard(validConfig({ pages: [validPage({ widgets: [w] })] }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('minValue must be less than maxValue'))).toBe(true)
  })

  it('rejects warningLevel outside [min, max]', () => {
    const w = gaugeWidget({
      config: {
        type: 'gauge',
        displayStyle: 'arc',
        minValue: 0,
        maxValue: 100,
        warningLevel: 200,
        dangerLevel: 80,
        decimalPlaces: 0,
      },
    })
    const result = validateDashboard(validConfig({ pages: [validPage({ widgets: [w] })] }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('warningLevel'))).toBe(true)
  })

  it('rejects dangerLevel outside [min, max]', () => {
    const w = gaugeWidget({
      config: {
        type: 'gauge',
        displayStyle: 'arc',
        minValue: 0,
        maxValue: 100,
        warningLevel: 80,
        dangerLevel: 200,
        decimalPlaces: 0,
      },
    })
    const result = validateDashboard(validConfig({ pages: [validPage({ widgets: [w] })] }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('dangerLevel'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Drift guard — schema variants that the old hand-rolled validator missed
// ---------------------------------------------------------------------------

describe('validateDashboard — accepts new action and topBar variants (drift guard)', () => {
  it('accepts cruise_control button action (#852)', () => {
    const button = {
      id: 'btn',
      type: 'button',
      signal: 'rpm',
      layout: { x: 0, y: 0, w: 80, h: 40, zOrder: 0 },
      style: VALID_STYLE,
      config: {
        type: 'button',
        label: 'CC',
        actions: [{ category: 'ecu', type: 'cruise_control', op: 'toggle' }],
      },
    }
    const result = validateDashboard(validConfig({ pages: [validPage({ widgets: [button] })] }))
    expect(result.valid).toBe(true)
  })

  it('accepts trackBadge topBar item (#844)', () => {
    const result = validateDashboard(
      validConfig({
        topBar: {
          ...VALID_TOPBAR,
          layout: [{ type: 'trackBadge', position: 'left' }],
        },
      })
    )
    expect(result.valid).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Signal catalog cross-reference (warnings only)
// ---------------------------------------------------------------------------

describe('validateDashboard — signal cross-reference', () => {
  it('warns on widget signal that is not in the catalog', () => {
    const w = gaugeWidget({ signal: 'unknown_sig' })
    const result = validateDashboard(validConfig({ pages: [validPage({ widgets: [w] })] }), {
      signalCatalog: signalCatalog(['rpm', 'speed_kph']),
    })
    expect(result.valid).toBe(true)
    expect(result.warnings.some((msg) => msg.includes('unknown_sig'))).toBe(true)
  })

  it('warns on topBar item signal that is not in the catalog', () => {
    const result = validateDashboard(
      validConfig({
        topBar: {
          ...VALID_TOPBAR,
          layout: [{ type: 'statusDot', signal: 'unknown_sig', position: 'left' }],
        },
      }),
      { signalCatalog: signalCatalog(['rpm']) }
    )
    expect(result.valid).toBe(true)
    expect(result.warnings.some((msg) => msg.includes('unknown_sig'))).toBe(true)
  })

  it('does not warn for the "any" sentinel signal on topBar items', () => {
    const result = validateDashboard(
      validConfig({
        topBar: {
          ...VALID_TOPBAR,
          layout: [{ type: 'statusDot', signal: 'any', position: 'left' }],
        },
      }),
      { signalCatalog: signalCatalog(['rpm']) }
    )
    expect(result.warnings).toEqual([])
  })

  it('produces no warnings when every signal is in the catalog', () => {
    const result = validateDashboard(validConfig(), {
      signalCatalog: signalCatalog(['rpm']),
    })
    expect(result.warnings).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Signal catalog structural pass-through (#700 ramps live in validate-signal)
// ---------------------------------------------------------------------------

describe('validateDashboard — signalCatalog option pass-through', () => {
  it('surfaces signal-catalog errors via validateDashboard', () => {
    const bogusCatalog: SignalConfig = {
      version: '1.15.0',
      protocol: 'custom_v1.0',
      canSpeedKbps: 500,
      signals: [
        {
          name: 'bad',
          canFrameId: '0x100',
          startByte: 0,
          byteLength: 2,
          bigEndian: false,
          signed: false,
          scale: 1,
          offset: 0,
          unit: '',
          min: 0,
          max: 100,
          timeoutMs: 1000,
          colorRamp: { stops: [{ value: 0, color: '#00FF00' }], interpolate: 'linear' },
        },
      ],
    }
    const result = validateDashboard(validConfig(), { signalCatalog: bogusCatalog })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('too few stops'))).toBe(true)
  })
})

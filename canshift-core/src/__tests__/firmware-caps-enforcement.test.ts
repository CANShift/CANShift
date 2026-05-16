// firmware-caps-enforcement.test.ts — Issue #700
//
// Validator must reject configs that would silently truncate on the firmware:
//  - button.actions.length > FIRMWARE_CAPS.MAX_BUTTON_ACTIONS
//  - signal.colorRamp.stops.length outside [2, FIRMWARE_CAPS.MAX_RAMP_STOPS]
//  - signal.colorRamp.stops[*].value not strictly ascending

import { FIRMWARE_CAPS } from '../constants/firmware-caps.js'
import type { ColorRampStop, SignalConfig } from '../types/signal.js'
import { validateDashboard } from '../validation/validate-dashboard.js'
import { validateSignalCatalog } from '../validation/validate-signal.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function minimalPage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'p1',
    widgets: [{ id: 'w0', type: 'gauge', minValue: 0, maxValue: 100, decimalPlaces: 0 }],
    ...overrides,
  }
}

function minimalConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: '1.14.0',
    name: 'Test',
    defaultPageId: 'p1',
    revLimitRpm: 7000,
    pages: [minimalPage()],
    ...overrides,
  }
}

function buttonWithActions(count: number): Record<string, unknown> {
  return {
    id: 'btn',
    type: 'button',
    actions: Array.from({ length: count }, (_, i) => ({
      category: 'dashboard',
      type: 'navigate',
      pageId: `p${i.toString()}`,
    })),
  }
}

function signalCatalogWithRamp(stops: ColorRampStop[]): SignalConfig {
  return {
    version: '1.14.0',
    protocol: 'custom_v1.0',
    canSpeedKbps: 500,
    signals: [
      {
        name: 'rpm',
        canFrameId: '0x370',
        startByte: 0,
        byteLength: 2,
        bigEndian: true,
        signed: false,
        scale: 1,
        offset: 0,
        unit: 'rpm',
        min: 0,
        max: 8000,
        timeoutMs: 1000,
        colorRamp: { stops, interpolate: 'linear' },
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Part A — button actions cap
// ---------------------------------------------------------------------------

describe('validateDashboard — button.actions cap (issue #700)', () => {
  it('accepts a button with exactly MAX_BUTTON_ACTIONS (4) actions', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [buttonWithActions(FIRMWARE_CAPS.MAX_BUTTON_ACTIONS)],
          }),
        ],
      })
    )
    expect(result.errors.filter((e) => e.includes('too many actions'))).toHaveLength(0)
  })

  it('rejects a button with MAX_BUTTON_ACTIONS + 1 (5) actions', () => {
    const result = validateDashboard(
      minimalConfig({
        pages: [
          minimalPage({
            widgets: [buttonWithActions(FIRMWARE_CAPS.MAX_BUTTON_ACTIONS + 1)],
          }),
        ],
      })
    )
    expect(result.valid).toBe(false)
    expect(
      result.errors.some(
        (e) =>
          e.includes('(button)') &&
          e.includes('too many actions') &&
          e.includes(`> ${FIRMWARE_CAPS.MAX_BUTTON_ACTIONS.toString()}`)
      )
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Part B — colorRamp.stops cap + monotonic value
// ---------------------------------------------------------------------------

describe('validateSignalCatalog — colorRamp.stops (issue #700)', () => {
  it('accepts a valid 3-stop ascending ramp', () => {
    const catalog = signalCatalogWithRamp([
      { value: 0, color: '#00FF00' },
      { value: 50, color: '#FFFF00' },
      { value: 100, color: '#FF0000' },
    ])
    const result = validateSignalCatalog(catalog)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('accepts a ramp at the cap (8 stops)', () => {
    const stops: ColorRampStop[] = Array.from({ length: FIRMWARE_CAPS.MAX_RAMP_STOPS }, (_, i) => ({
      value: i * 10,
      color: '#00FF00',
    }))
    const result = validateSignalCatalog(signalCatalogWithRamp(stops))
    expect(result.valid).toBe(true)
  })

  it('rejects a ramp with only 1 stop (below the floor of 2)', () => {
    const result = validateSignalCatalog(signalCatalogWithRamp([{ value: 0, color: '#00FF00' }]))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('too few stops'))).toBe(true)
  })

  it('rejects a ramp with 9 stops (above MAX_RAMP_STOPS=8)', () => {
    const stops: ColorRampStop[] = Array.from(
      { length: FIRMWARE_CAPS.MAX_RAMP_STOPS + 1 },
      (_, i) => ({ value: i * 10, color: '#00FF00' })
    )
    const result = validateSignalCatalog(signalCatalogWithRamp(stops))
    expect(result.valid).toBe(false)
    expect(
      result.errors.some(
        (e) =>
          e.includes('too many stops') && e.includes(`> ${FIRMWARE_CAPS.MAX_RAMP_STOPS.toString()}`)
      )
    ).toBe(true)
  })

  it('rejects a ramp with non-ascending values (equal)', () => {
    const result = validateSignalCatalog(
      signalCatalogWithRamp([
        { value: 0, color: '#00FF00' },
        { value: 50, color: '#FFFF00' },
        { value: 50, color: '#FF0000' },
      ])
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('strictly greater than previous'))).toBe(true)
  })

  it('rejects a ramp with non-ascending values (descending)', () => {
    const result = validateSignalCatalog(
      signalCatalogWithRamp([
        { value: 100, color: '#00FF00' },
        { value: 50, color: '#FFFF00' },
        { value: 0, color: '#FF0000' },
      ])
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('strictly greater than previous'))).toBe(true)
  })

  it('passes through ramp errors via validateDashboard when signalCatalog option is supplied', () => {
    const stops: ColorRampStop[] = Array.from(
      { length: FIRMWARE_CAPS.MAX_RAMP_STOPS + 1 },
      (_, i) => ({ value: i * 10, color: '#00FF00' })
    )
    const result = validateDashboard(minimalConfig(), {
      signalCatalog: signalCatalogWithRamp(stops),
    })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('too many stops'))).toBe(true)
  })
})

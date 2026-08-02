import { describe, expect, it } from 'vitest'
import { WidgetSchema } from '@tmbk/canshift-core'
import type { DashboardConfig, SignalDef } from '@tmbk/canshift-core'
import { useDashboardStore } from '../stores/dashboard.store'
import { defaultWidgetForSignal, isEnumSignal, signalThreshold } from './default-widget'

const baseSignal = (overrides: Partial<SignalDef>): SignalDef =>
  ({
    name: 'coolant_temp',
    canFrameId: '0x370',
    startByte: 0,
    byteLength: 2,
    bigEndian: true,
    signed: false,
    scale: 0.1,
    offset: 0,
    unit: '°C',
    min: -40,
    max: 150,
    timeoutMs: 1000,
    ...overrides,
  }) as SignalDef

const gearSignal = baseSignal({
  name: 'gear',
  byteLength: 1,
  scale: 1,
  unit: '',
  min: 0,
  max: 6,
})

describe('defaultWidgetForSignal', () => {
  it('creates a gear widget for an enum-like signal', () => {
    const widget = defaultWidgetForSignal(gearSignal)
    expect(widget.type).toBe('gear')
    expect(widget.signal).toBe('gear')
    expect(widget.config).toEqual({ type: 'gear', decimalPlaces: 0 })
  })

  it('creates a warning widget when the profile defines a threshold', () => {
    const widget = defaultWidgetForSignal(baseSignal({ warningLevel: 110, dangerLevel: 120 }))
    expect(widget.type).toBe('warning')
    expect(widget.config).toMatchObject({ type: 'warning', threshold: 120 })
  })

  it('falls back to warningLevel when no dangerLevel exists', () => {
    expect(signalThreshold(baseSignal({ warningLevel: 110 }))).toBe(110)
  })

  it('creates a numeric gauge for a plain scalar, bound and unit-suffixed', () => {
    const widget = defaultWidgetForSignal(baseSignal({ name: 'speed_kph', unit: 'km/h', max: 300 }))
    expect(widget.type).toBe('gauge')
    expect(widget.signal).toBe('speed_kph')
    expect(widget.config).toMatchObject({
      type: 'gauge',
      displayStyle: 'numeric',
      minValue: -40,
      maxValue: 300,
      suffix: 'km/h',
      decimalPlaces: 0,
    })
  })

  it('keeps one decimal for narrow ranges', () => {
    const widget = defaultWidgetForSignal(
      baseSignal({ name: 'lambda_1', unit: 'AFR', min: 0.6, max: 1.6 })
    )
    expect(widget.config).toMatchObject({ decimalPlaces: 1 })
  })

  it('produces schema-valid widgets for all three shapes', () => {
    const shapes = [
      gearSignal,
      baseSignal({ dangerLevel: 120 }),
      baseSignal({ name: 'speed_kph', unit: 'km/h' }),
    ]
    for (const sig of shapes) {
      expect(WidgetSchema.safeParse(defaultWidgetForSignal(sig)).success).toBe(true)
    }
  })

  it('does not treat scaled or unit-carrying one-byte signals as enums', () => {
    expect(isEnumSignal(baseSignal({ byteLength: 1, scale: 0.5, unit: '' }))).toBe(false)
    expect(isEnumSignal(baseSignal({ byteLength: 1, scale: 1, unit: '%' }))).toBe(false)
  })
})

describe('signal drop through addWidget', () => {
  const pageConfig = (): DashboardConfig =>
    ({
      version: '1.26.0',
      defaultPageId: 'p1',
      topBar: { height: 16, bgColor: '#000000', textColor: '#FFFFFF' },
      pages: [
        {
          id: 'p1',
          backgroundColor: '#000000',
          showTopBar: true,
          visible: true,
          widgets: [
            {
              id: 'existing',
              type: 'gauge',
              signal: 'rpm',
              layout: { col: 0, colSpan: 6, row: 0, rowSpan: 6, zOrder: 0 },
            },
          ],
        },
      ],
    }) as unknown as DashboardConfig

  it('places the dropped widget on a free slot and labels the history entry', () => {
    useDashboardStore.getState().setConfig(pageConfig())
    const widget = defaultWidgetForSignal(baseSignal({ name: 'speed_kph', unit: 'km/h' }))

    useDashboardStore.getState().addWidget('p1', widget)

    const state = useDashboardStore.getState()
    const page = state.config?.pages[0]
    const placed = page?.widgets.find((w) => w.signal === 'speed_kph')
    expect(placed).toBeDefined()
    expect(placed?.layout.col).toBe(6)
    expect(placed?.layout.row).toBe(0)
    expect(state.past[state.past.length - 1]?.label).toBe('Added speed_kph')
  })
})

import { HexColorSchema } from '../schemas/common.js'
import { WidgetSchema } from '../schemas/dashboard.js'

const hex = (value: string): ReturnType<typeof HexColorSchema.parse> => HexColorSchema.parse(value)

const widgetStyle = {
  primaryColor: hex('#FFFFFF'),
  secondaryColor: hex('#000000'),
  warningColor: hex('#FF8800'),
  criticalColor: hex('#FF4444'),
  textColor: hex('#FFFFFF'),
  fontSize: 14,
}

const baseLayout = { col: 0, colSpan: 3, row: 0, rowSpan: 2, zOrder: 0 }

describe('WidgetSchema — signal field required only for signal-consuming widgets', () => {
  it('accepts a timer widget with empty signal (firmware impl is self-contained)', () => {
    const result = WidgetSchema.safeParse({
      id: 'w0',
      type: 'timer',
      signal: '',
      layout: baseLayout,
      style: widgetStyle,
      config: { type: 'timer', autoStart: true, format: 'mm:ss' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects a gauge widget with empty signal', () => {
    const result = WidgetSchema.safeParse({
      id: 'w0',
      type: 'gauge',
      signal: '',
      layout: baseLayout,
      style: widgetStyle,
      config: {
        type: 'gauge',
        displayStyle: 'arc',
        minValue: 0,
        maxValue: 100,
        dangerLevel: 90,
        decimalPlaces: 0,
      },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('signal'))).toBe(true)
    }
  })

  it('rejects a warning widget with empty signal', () => {
    const result = WidgetSchema.safeParse({
      id: 'w0',
      type: 'warning',
      signal: '',
      layout: baseLayout,
      style: widgetStyle,
      config: { type: 'warning', threshold: 90 },
    })
    expect(result.success).toBe(false)
  })

  it('rejects a gear widget with empty signal', () => {
    const result = WidgetSchema.safeParse({
      id: 'w0',
      type: 'gear',
      signal: '',
      layout: baseLayout,
      style: widgetStyle,
      config: { type: 'gear', decimalPlaces: 0 },
    })
    expect(result.success).toBe(false)
  })
})

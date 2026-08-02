import { HexColorSchema, SensorIconNameSchema } from '@tmbk/canshift-core'
import type { SensorIconName, SignalDef, Widget, WidgetConfig } from '@tmbk/canshift-core'
import { SIZE_TOKENS } from './size-tokens'
import { createId } from './id'

const ENUM_MAX_RANGE = 12
const DECIMALS_RANGE_CUTOFF = 50
const SHIFT_LIGHT_RED_SEGMENTS = 5

export const SIGNAL_DRAG_MIME = 'application/x-canshift-signal'
export const WIDGET_TYPE_DRAG_MIME = 'application/x-canshift-widget-type'

export const SIGNAL_CONSUMING_TYPES: ReadonlySet<string> = new Set([
  'gauge',
  'warning',
  'gear',
  'shift_light',
])

export const DEFAULT_WIDGET_STYLE = {
  primaryColor: HexColorSchema.parse('#FF4444'),
  secondaryColor: HexColorSchema.parse('#333333'),
  warningColor: HexColorSchema.parse('#FF8800'),
  criticalColor: HexColorSchema.parse('#FF0000'),
  textColor: HexColorSchema.parse('#FFFFFF'),
}

export const isEnumSignal = (signal: SignalDef): boolean =>
  signal.byteLength === 1 &&
  signal.scale === 1 &&
  signal.unit === '' &&
  signal.max - signal.min <= ENUM_MAX_RANGE

export const signalThreshold = (signal: SignalDef): number | undefined =>
  signal.dangerLevel ?? signal.warningLevel ?? signal.highDangerLevel ?? signal.highWarningLevel

const iconForSignal = (signal: SignalDef): SensorIconName | undefined => {
  const fromType = SensorIconNameSchema.safeParse(signal.type)
  if (fromType.success) return fromType.data
  const fromName = SensorIconNameSchema.safeParse(signal.name)
  return fromName.success ? fromName.data : undefined
}

const gearConfig = (): WidgetConfig => ({ type: 'gear', decimalPlaces: 0 })

const warningConfig = (signal: SignalDef): WidgetConfig => {
  const config: WidgetConfig = {
    type: 'warning',
    threshold: signalThreshold(signal) ?? signal.max,
  }
  const icon = iconForSignal(signal)
  if (icon) config.iconName = icon
  return config
}

const gaugeConfig = (signal: SignalDef): WidgetConfig => {
  const config: WidgetConfig = {
    type: 'gauge',
    displayStyle: 'numeric',
    minValue: signal.min,
    maxValue: signal.max,
    dangerLevel: signal.dangerLevel ?? signal.max,
    decimalPlaces: signal.max - signal.min > DECIMALS_RANGE_CUTOFF ? 0 : 1,
  }
  if (signal.unit !== '') config.suffix = signal.unit
  const icon = iconForSignal(signal)
  if (icon) config.iconName = icon
  return config
}

const shiftLightConfig = (signal: SignalDef): WidgetConfig => ({
  type: 'shift_light',
  startValue: Math.max(0, signal.min),
  redSegments: SHIFT_LIGHT_RED_SEGMENTS,
})

const configForSignal = (signal: SignalDef): WidgetConfig => {
  if (isEnumSignal(signal)) return gearConfig()
  if (signalThreshold(signal) !== undefined) return warningConfig(signal)
  return gaugeConfig(signal)
}

const spanForConfig = (config: WidgetConfig): { colSpan: number; rowSpan: number } => {
  if (config.type === 'shift_light') return { colSpan: 12, rowSpan: 1 }
  const token = config.type === 'gauge' ? SIZE_TOKENS.XL : SIZE_TOKENS.L
  return { colSpan: token.colSpan, rowSpan: token.rowSpan }
}

const widgetFromConfig = (config: WidgetConfig, signalName: string): Widget => ({
  id: createId(config.type),
  type: config.type,
  signal: signalName,
  layout: { col: 0, row: 0, zOrder: 0, ...spanForConfig(config) },
  style: { ...DEFAULT_WIDGET_STYLE, fontSize: 16 },
  config,
})

export const defaultWidgetForSignal = (signal: SignalDef): Widget =>
  widgetFromConfig(configForSignal(signal), signal.name)

export const widgetOfTypeForSignal = (type: string, signal: SignalDef): Widget | null => {
  switch (type) {
    case 'gear':
      return widgetFromConfig(gearConfig(), signal.name)
    case 'warning':
      return widgetFromConfig(warningConfig(signal), signal.name)
    case 'gauge':
      return widgetFromConfig(gaugeConfig(signal), signal.name)
    case 'shift_light':
      return widgetFromConfig(shiftLightConfig(signal), signal.name)
    default:
      return null
  }
}

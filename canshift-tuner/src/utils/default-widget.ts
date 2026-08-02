import { HexColorSchema, SensorIconNameSchema } from '@tmbk/canshift-core'
import type { SensorIconName, SignalDef, Widget, WidgetConfig } from '@tmbk/canshift-core'
import { SIZE_TOKENS } from './size-tokens'
import { createId } from './id'

const ENUM_MAX_RANGE = 12
const DECIMALS_RANGE_CUTOFF = 50

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

const configForSignal = (signal: SignalDef): WidgetConfig => {
  if (isEnumSignal(signal)) return { type: 'gear', decimalPlaces: 0 }

  const icon = iconForSignal(signal)
  const threshold = signalThreshold(signal)
  if (threshold !== undefined) {
    const config: WidgetConfig = { type: 'warning', threshold }
    if (icon) config.iconName = icon
    return config
  }

  const config: WidgetConfig = {
    type: 'gauge',
    displayStyle: 'numeric',
    minValue: signal.min,
    maxValue: signal.max,
    dangerLevel: signal.dangerLevel ?? signal.max,
    decimalPlaces: signal.max - signal.min > DECIMALS_RANGE_CUTOFF ? 0 : 1,
  }
  if (signal.unit !== '') config.suffix = signal.unit
  if (icon) config.iconName = icon
  return config
}

export const SIGNAL_DRAG_MIME = 'application/x-canshift-signal'

const spanForConfig = (config: WidgetConfig): { colSpan: number; rowSpan: number } => {
  const token = config.type === 'gauge' ? SIZE_TOKENS.XL : SIZE_TOKENS.L
  return { colSpan: token.colSpan, rowSpan: token.rowSpan }
}

export const defaultWidgetForSignal = (signal: SignalDef): Widget => {
  const config = configForSignal(signal)
  return {
    id: createId(config.type),
    type: config.type,
    signal: signal.name,
    layout: { col: 0, row: 0, zOrder: 0, ...spanForConfig(config) },
    style: { ...DEFAULT_WIDGET_STYLE, fontSize: 16 },
    config,
  }
}

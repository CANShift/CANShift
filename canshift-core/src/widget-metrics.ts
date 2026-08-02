import type { HexColor } from './schemas/common.js'
import type { ColorRamp, ColorRampStop } from './schemas/signal.js'
import { SENSOR_DEFAULT_RAMPS, colorAtValue } from './sensor-defaults.js'
import type { SensorKind } from './sensor-defaults.js'

const asHex = (value: string): HexColor => value as HexColor

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value)

const truncDiv = (value: number, numerator: number, denominator: number): number =>
  Math.trunc((value * numerator) / denominator)

export const WIDGET_ZONE_COLORS = {
  normal: asHex('#00CC44'),
  warning: asHex('#FF8800'),
  danger: asHex('#FF4444'),
} as const satisfies Record<'normal' | 'warning' | 'danger', HexColor>

export const WIDGET_TEXT_COLORS = {
  day: asHex('#000000'),
  night: asHex('#FFFFFF'),
} as const satisfies Record<'day' | 'night', HexColor>

export const WIDGET_STALE_TEXT_COLORS = {
  day: asHex('#888888'),
  night: asHex('#555555'),
} as const satisfies Record<'day' | 'night', HexColor>

export const widgetTextColor = (isDayMode: boolean): HexColor =>
  isDayMode ? WIDGET_TEXT_COLORS.day : WIDGET_TEXT_COLORS.night

export const widgetStaleTextColor = (isDayMode: boolean): HexColor =>
  isDayMode ? WIDGET_STALE_TEXT_COLORS.day : WIDGET_STALE_TEXT_COLORS.night

export const WIDGET_FONT_CLAMP = { min: 12, max: 48 } as const
export const VALUE_FRAC_FONT_RATIO = 0.7
export const VALUE_UNIT_FONT_SIZE = 12
export const VALUE_UNIT_RATIO = { numerator: 1, denominator: 4 } as const
export const VALUE_UNIT_FONT_MIN = 10
export const STALE_PLACEHOLDER = '--'

export const valueUnitFontSize = (valueFontSize: number): number => {
  const size = truncDiv(valueFontSize, VALUE_UNIT_RATIO.numerator, VALUE_UNIT_RATIO.denominator)
  return size < VALUE_UNIT_FONT_MIN ? VALUE_UNIT_FONT_MIN : size
}

export const widgetFracFontSize = (intFontSize: number): number => {
  const frac = truncDiv(intFontSize, 7, 10)
  return frac < WIDGET_FONT_CLAMP.min ? WIDGET_FONT_CLAMP.min : frac
}

export const GAUGE_ARC = {
  sweepDeg: 270,
  rotationDeg: 135,
  strokeRatio: 0.3,
  strokeWidthFloor: 5,
  strokeWidthRatioW: 0.48,
  strokeWidthRatioH: 0.49,
  minDiameter: 40,
  containerPadding: 4,
  yShift: 2,
} as const

export const GAUGE_TRACK_COLORS = {
  plain: asHex('#222222'),
  gradient: asHex('#2A2A2A'),
} as const satisfies Record<'plain' | 'gradient', HexColor>

export const WIDGET_TOP_RULE = {
  primaryPx: 2,
  secondaryPx: 1,
  primaryFontMin: 32,
  trackColor: GAUGE_TRACK_COLORS.plain,
  dangerColor: WIDGET_ZONE_COLORS.danger,
} as const

export const widgetTopRulePx = (valueFontSize: number): number =>
  valueFontSize >= WIDGET_TOP_RULE.primaryFontMin
    ? WIDGET_TOP_RULE.primaryPx
    : WIDGET_TOP_RULE.secondaryPx

export const GAUGE_VALUE_FONT_BREAKPOINTS = [
  { minHeight: 165, size: 48 },
  { minHeight: 125, size: 32 },
  { minHeight: 95, size: 24 },
  { minHeight: 0, size: 20 },
] as const

export const gaugeValueFontSize = (height: number): number => {
  for (const bp of GAUGE_VALUE_FONT_BREAKPOINTS) {
    if (height >= bp.minHeight) return bp.size
  }
  return 20
}

export const gaugeArcStrokeWidth = (width: number, height: number): number => {
  const radius = Math.min(width * GAUGE_ARC.strokeWidthRatioW, height * GAUGE_ARC.strokeWidthRatioH)
  const stroke = radius * GAUGE_ARC.strokeRatio
  return stroke < GAUGE_ARC.strokeWidthFloor ? GAUGE_ARC.strokeWidthFloor : stroke
}

export const gaugeValueAngle = (value: number, min: number, max: number): number => {
  const span = max - min
  const pct = span > 0 ? clamp01((value - min) / span) : 0
  return pct * GAUGE_ARC.sweepDeg
}

const GAUGE_GRADIENT_RAMP: ColorRamp = {
  interpolate: 'linear',
  stops: [
    { value: 0, color: WIDGET_ZONE_COLORS.normal },
    { value: 0.5, color: WIDGET_ZONE_COLORS.warning },
    { value: 1, color: WIDGET_ZONE_COLORS.danger },
  ],
}

export const gaugeGradientColorAt = (pct: number): HexColor =>
  colorAtValue(GAUGE_GRADIENT_RAMP, clamp01(pct))

export const LABEL_FONT_RATIO = { height: 0.65, width: 0.52 } as const

export const labelFontSize = (width: number, height: number): number => {
  const byHeight = truncDiv(height, 65, 100)
  const byWidth = truncDiv(width, 52, 100)
  const size = Math.min(byHeight, byWidth)
  if (size < WIDGET_FONT_CLAMP.min) return WIDGET_FONT_CLAMP.min
  if (size > WIDGET_FONT_CLAMP.max) return WIDGET_FONT_CLAMP.max
  return size
}

export const GEAR_FONT_RATIO = { height: 0.85, width: 0.72 } as const

export const gearFontSize = (width: number, height: number): number => {
  const byHeight = truncDiv(height, 85, 100)
  const byWidth = truncDiv(width, 72, 100)
  const size = Math.min(byHeight, byWidth)
  if (size < WIDGET_FONT_CLAMP.min) return WIDGET_FONT_CLAMP.min
  if (size > WIDGET_FONT_CLAMP.max) return WIDGET_FONT_CLAMP.max
  return size
}

export const GEAR_NEUTRAL_GLYPH = 'N'
export const GEAR_REVERSE_GLYPH = 'R'

export const gearGlyph = (gear: number): string => {
  const rounded = Math.trunc(gear)
  if (rounded === 0) return GEAR_NEUTRAL_GLYPH
  if (rounded < 0) return GEAR_REVERSE_GLYPH
  return String(rounded)
}

export const WARNING_BLINK_PERIOD_MS = 1000
export const WARNING_BLINK_OPACITY = { min: 0x00, max: 0xcc } as const
export const WARNING_IDLE_BG_OPACITY = 0x18
export const WARNING_STALE_BORDER_WIDTH = 1
export const WARNING_SIGNAL_LABEL_MIN_HEIGHT = 28

export const isWarningTripped = (
  value: number,
  threshold: number,
  invertLogic: boolean
): boolean => (invertLogic ? value < threshold : value >= threshold)

export const TIMER_LONG_PRESS_MS = 600
export const TIMER_BLINK_PERIOD_MS = 1000
export const TIMER_STATE_BORDER_WIDTH = 2
export const TIMER_BORDER_COLORS = {
  running: WIDGET_ZONE_COLORS.normal,
  paused: WIDGET_ZONE_COLORS.warning,
} as const satisfies Record<'running' | 'paused', HexColor>

export const TIMER_FONT_BREAKPOINTS = [
  { minHeight: 110, size: 32 },
  { minHeight: 80, size: 24 },
  { minHeight: 0, size: 20 },
] as const

export const timerFontSize = (height: number): number => {
  for (const bp of TIMER_FONT_BREAKPOINTS) {
    if (height >= bp.minHeight) return bp.size
  }
  return 20
}

const pad = (value: number, width: number): string => String(value).padStart(width, '0')

export const formatTimerMmSs = (elapsedMs: number, colonVisible: boolean): string => {
  const totalSeconds = Math.floor(elapsedMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const separator = colonVisible ? ':' : ' '
  return `${pad(minutes, 2)}${separator}${pad(seconds, 2)}`
}

export const formatTimerSsMmm = (elapsedMs: number): string => {
  const totalSeconds = Math.floor(elapsedMs / 1000)
  const millis = elapsedMs % 1000
  return `${pad(totalSeconds, 2)}.${pad(millis, 3)}`
}

export const SENSOR_DEFAULT_RANGES = {
  coolant_temp: { min: 0, max: 120 },
  oil_temp: { min: 0, max: 150 },
  oil_press: { min: 0, max: 8 },
  battery_volts: { min: 8, max: 16 },
  rpm: { min: 0, max: 8000 },
  afr: { min: 10, max: 18 },
  boost: { min: -1, max: 2 },
  intake_temp: { min: 0, max: 80 },
  egt: { min: 0, max: 1000 },
} as const satisfies Record<SensorKind, { min: number; max: number }>

export const sensorDefaultRange = (kind: SensorKind): { min: number; max: number } =>
  SENSOR_DEFAULT_RANGES[kind]

export const SENSOR_DANGER_COLOR = asHex('#CC3333')

export interface SensorDangerThreshold {
  threshold: number
  invertLogic: boolean
}

const isDanger = (stop: ColorRampStop): boolean => stop.color === SENSOR_DANGER_COLOR

const leadingDangerStops = (stops: readonly ColorRampStop[]): ColorRampStop[] => {
  const run: ColorRampStop[] = []
  for (const stop of stops) {
    if (!isDanger(stop)) break
    run.push(stop)
  }
  return run
}

const trailingDangerStops = (stops: readonly ColorRampStop[]): ColorRampStop[] => {
  const run: ColorRampStop[] = []
  for (let i = stops.length - 1; i >= 0; i--) {
    const stop = stops[i]
    if (!stop || !isDanger(stop)) break
    run.unshift(stop)
  }
  return run
}

export const sensorDefaultDangerThreshold = (kind: SensorKind): SensorDangerThreshold => {
  const stops = SENSOR_DEFAULT_RAMPS[kind].stops
  const trailing = trailingDangerStops(stops)
  if (trailing.length > 0) {
    const entry = trailing[0]
    if (entry) return { threshold: entry.value, invertLogic: false }
  }
  const leading = leadingDangerStops(stops)
  const boundary = leading[leading.length - 1]
  if (boundary) return { threshold: boundary.value, invertLogic: true }
  return { threshold: SENSOR_DEFAULT_RANGES[kind].max, invertLogic: false }
}

export const SECONDARY_BAR = {
  heightPx: 3,
  topGapPx: 7,
} as const

export const SHIFT_LIGHT = {
  segments: 12,
  gapPx: 3,
  defaultRedSegments: 5,
  defaultStartRpm: 3000,
  litColor: asHex('#FFFFFF'),
  redColor: asHex('#FF4444'),
  trackColor: asHex('#222222'),
} as const

export const shiftLightLitSegments = (
  value: number,
  startValue: number,
  fullValue: number
): number => {
  if (!(fullValue > startValue)) return 0
  const pct = (value - startValue) / (fullValue - startValue)
  if (pct <= 0) return 0
  if (pct >= 1) return SHIFT_LIGHT.segments
  return Math.floor(pct * SHIFT_LIGHT.segments)
}

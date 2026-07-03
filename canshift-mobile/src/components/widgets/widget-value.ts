import {
  GAUGE_ARC,
  GEAR_NEUTRAL_GLYPH,
  WIDGET_ZONE_COLORS,
  gaugeValueAngle,
  gearGlyph,
  isWarningTripped,
  widgetStaleTextColor,
  widgetTextColor,
} from '@tmbk/canshift-core'

export interface ValueParts {
  int: string
  frac: string
}

const THOUSANDS_TAIL = 3

export const formatWidgetValue = (value: number, decimals: number): string =>
  decimals === 0 ? Math.round(value).toString() : value.toFixed(decimals)

export const splitWidgetValue = (formatted: string, splitThousands: boolean): ValueParts => {
  const dot = formatted.indexOf('.')
  if (dot >= 0) {
    return { int: formatted.slice(0, dot), frac: formatted.slice(dot) }
  }
  if (!splitThousands) {
    return { int: formatted, frac: '' }
  }
  const negative = formatted.startsWith('-')
  const digits = negative ? formatted.slice(1) : formatted
  if (digits.length > THOUSANDS_TAIL) {
    const headLen = digits.length - THOUSANDS_TAIL
    return {
      int: formatted.slice(0, headLen + (negative ? 1 : 0)),
      frac: digits.slice(headLen),
    }
  }
  return { int: formatted, frac: '' }
}

export const gaugeFillFraction = (value: number, min: number, max: number): number =>
  gaugeValueAngle(value, min, max) / GAUGE_ARC.sweepDeg

export type WarnState = 'idle' | 'alarm' | 'stale'

export const gearGlyphFor = (value: number | undefined): string =>
  value === undefined ? GEAR_NEUTRAL_GLYPH : gearGlyph(value)

export const gearColor = (value: number | undefined, dayMode: boolean): string => {
  if (value === undefined) return widgetStaleTextColor(dayMode)
  return Math.trunc(value) < 0 ? WIDGET_ZONE_COLORS.warning : widgetTextColor(dayMode)
}

export const warningState = (
  value: number | undefined,
  threshold: number,
  invertLogic: boolean
): WarnState => {
  if (value === undefined) return 'stale'
  return isWarningTripped(value, threshold, invertLogic) ? 'alarm' : 'idle'
}

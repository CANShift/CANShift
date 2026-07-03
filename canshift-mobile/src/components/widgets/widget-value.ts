import { GAUGE_ARC, gaugeValueAngle } from '@tmbk/canshift-core'

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

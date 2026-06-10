import type { Widget } from '@tmbk/canshift-core'
import { thresholdPct } from '../widgetPreview.styles'

const GRADIENT_GREEN = { r: 0x00, g: 0xcc, b: 0x44 }
const GRADIENT_ORANGE = { r: 0xff, g: 0x88, b: 0x00 }
const GRADIENT_RED = { r: 0xff, g: 0x44, b: 0x44 }

const clamp01 = (value: number): number => {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

const lerpChannel = (a: number, b: number, t: number): number => {
  const v = a + (b - a) * t
  if (v < 0) return 0
  if (v > 255) return 255
  return Math.round(v)
}

const rgbToHex = (r: number, g: number, b: number): string => {
  const hex = (n: number): string => n.toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

export const interpolateGreenOrangeRed = (pct: number): string => {
  const p = clamp01(pct)
  if (p <= 0.5) {
    const t = p * 2
    return rgbToHex(
      lerpChannel(GRADIENT_GREEN.r, GRADIENT_ORANGE.r, t),
      lerpChannel(GRADIENT_GREEN.g, GRADIENT_ORANGE.g, t),
      lerpChannel(GRADIENT_GREEN.b, GRADIENT_ORANGE.b, t)
    )
  }
  const t = (p - 0.5) * 2
  return rgbToHex(
    lerpChannel(GRADIENT_ORANGE.r, GRADIENT_RED.r, t),
    lerpChannel(GRADIENT_ORANGE.g, GRADIENT_RED.g, t),
    lerpChannel(GRADIENT_ORANGE.b, GRADIENT_RED.b, t)
  )
}

export const DEMO_PCT = 0.65

export const effectiveValue = (
  testValue: number | null | undefined,
  min: number,
  max: number
): { pct: number; raw: number } => {
  const range = max - min || 1
  if (testValue == null || !Number.isFinite(testValue)) {
    return { pct: DEMO_PCT, raw: min + range * DEMO_PCT }
  }
  const pct = Math.max(0, Math.min(1, (testValue - min) / range))
  return { pct, raw: testValue }
}

export const isDangerState = (widget: Widget, testValue: number | null | undefined): boolean => {
  const cfg = widget.config
  if (cfg.type === 'gauge') {
    const { pct } = effectiveValue(testValue, cfg.minValue, cfg.maxValue)
    const dangerPct = thresholdPct(cfg.dangerLevel, cfg.minValue, cfg.maxValue)
    return pct >= dangerPct
  }
  return false
}

export const splitDecimal = (s: string): { int: string; frac: string } => {
  const dot = s.indexOf('.')
  if (dot < 0) return { int: s, frac: '' }
  return { int: s.slice(0, dot), frac: s.slice(dot) }
}

export const FRAC_FONT_SCALE = 0.7

const svgPt = (cx: number, cy: number, r: number, angleDeg: number) => {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

export const gaugeArcD = (
  cx: number,
  cy: number,
  r: number,
  fromPct: number,
  toPct: number
): string => {
  const START_DEG = 135
  const SWEEP_DEG = 270
  const fromAngle = START_DEG + fromPct * SWEEP_DEG
  const toAngle = START_DEG + toPct * SWEEP_DEG
  const from = svgPt(cx, cy, r, fromAngle)
  const to = svgPt(cx, cy, r, toAngle)
  const sweep = (toPct - fromPct) * SWEEP_DEG
  const largeArc = sweep > 180 ? 1 : 0
  const rStr = String(r)
  const laStr = String(largeArc)
  return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} A ${rStr} ${rStr} 0 ${laStr} 1 ${to.x.toFixed(2)} ${to.y.toFixed(2)}`
}

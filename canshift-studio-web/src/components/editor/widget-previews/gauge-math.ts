// widget-previews/gauge-math.ts — Math + SVG-path helpers shared by the arc
// and numeric gauge renderers. All exports are pure functions so the gauge
// preview files can stay focused on layout / SVG markup.

import type { Widget } from '@tmbk/canshift-core'
import { thresholdPct } from '../widgetPreview.styles'

// ---------------------------------------------------------------------------
// Gradient helper (issue #175) — green → orange → red across [0,1].
// Mirrors firmware's interpolateGreenOrangeRed() exactly. Returns a CSS
// "#RRGGBB" string suitable for SVG `stroke`.
// ---------------------------------------------------------------------------

const GRADIENT_GREEN = { r: 0x00, g: 0xcc, b: 0x44 }
const GRADIENT_ORANGE = { r: 0xff, g: 0x88, b: 0x00 }
const GRADIENT_RED = { r: 0xff, g: 0x44, b: 0x44 }

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function lerpChannel(a: number, b: number, t: number): number {
  const v = a + (b - a) * t
  if (v < 0) return 0
  if (v > 255) return 255
  return Math.round(v)
}

function rgbToHex(r: number, g: number, b: number): string {
  const hex = (n: number): string => n.toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

export function interpolateGreenOrangeRed(pct: number): string {
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

// ---------------------------------------------------------------------------
// Demo value resolution — gauges show a static plausible percentage when no
// test-mode value is pinned, so the preview keeps a sensible visual.
// ---------------------------------------------------------------------------

/** Fraction of the gauge range used as the static demo value. */
export const DEMO_PCT = 0.65

/**
 * Compute the percentage and raw value to render for a preview.
 * When the test-mode panel pins a value (testValue != null) the preview reads
 * from there; otherwise it falls back to the static demo percentage so the
 * inspector keeps a sensible visual when test mode is off.
 */
export function effectiveValue(
  testValue: number | null | undefined,
  min: number,
  max: number
): { pct: number; raw: number } {
  const range = max - min || 1
  if (testValue == null || !Number.isFinite(testValue)) {
    return { pct: DEMO_PCT, raw: min + range * DEMO_PCT }
  }
  const pct = Math.max(0, Math.min(1, (testValue - min) / range))
  return { pct, raw: testValue }
}

/**
 * True when the resolved value sits at or above the widget's `dangerLevel`.
 * Only gauges carry a threshold today. Other widget types never enter the
 * danger-blink state — `WidgetPreviewImpl` reads this to decide whether the
 * value text / fill blinks.
 */
export function isDangerState(widget: Widget, testValue: number | null | undefined): boolean {
  const cfg = widget.config
  if (cfg.type === 'gauge') {
    const { pct } = effectiveValue(testValue, cfg.minValue, cfg.maxValue)
    const dangerPct = thresholdPct(cfg.dangerLevel, cfg.minValue, cfg.maxValue)
    return pct >= dangerPct
  }
  return false
}

// ---------------------------------------------------------------------------
// Decimal split helper — splits "13.3" into "13" + ".3" so the fractional
// part can be rendered at a slightly smaller font. Used by numeric / arc
// readouts where decimals carry less perceptual weight than the integer
// part (AFR, voltage, lambda, pressures). Returns empty `frac` when no
// decimal point is present.
// ---------------------------------------------------------------------------

export function splitDecimal(s: string): { int: string; frac: string } {
  const dot = s.indexOf('.')
  if (dot < 0) return { int: s, frac: '' }
  return { int: s.slice(0, dot), frac: s.slice(dot) }
}

/**
 * Fractional digits render at this fraction of the integer-part font so they
 * sit clearly subordinate without disappearing. Same ratio used in firmware
 * label_widget.cpp / gauge_widget.cpp.
 */
export const FRAC_FONT_SCALE = 0.7

// ---------------------------------------------------------------------------
// Arc-path helpers (SVG coordinate system: x→right, y→down)
// ---------------------------------------------------------------------------

/** Point on a circle in SVG coordinates. angleDeg=0 → right, 90 → down. */
function svgPt(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

/**
 * SVG arc path string.
 * The gauge starts at SVG 135° (lower-left) and sweeps 270° clockwise to 45° (lower-right).
 * fromPct / toPct are fractions [0, 1] of the 270° sweep.
 */
export function gaugeArcD(
  cx: number,
  cy: number,
  r: number,
  fromPct: number,
  toPct: number
): string {
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

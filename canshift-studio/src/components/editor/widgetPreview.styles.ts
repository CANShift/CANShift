// widgetPreview.styles.ts — Shared visual tokens and helpers used across
// every widget preview renderer. Extracted from WidgetPreview.tsx to keep
// individual renderers focused on their own SVG/HTML structure and to give
// the studio a single place to tweak the cross-widget look.

import type { CSSProperties } from 'react'
import {
  sensorOkColor,
  sensorWarningColor,
  type SensorIconName,
  type WidgetLabelPosition,
} from '@tmbk/canshift-core'

// ---------------------------------------------------------------------------
// Font + animation tokens
// ---------------------------------------------------------------------------

/** Studio mirrors firmware's compiled-in Orbitron racing display face (#431). */
export const FONT_FAMILY = 'Orbitron, sans-serif'

/** Heavy weight for primary numeric values across previews (matches Orbitron set). */
export const FONT_WEIGHT_VALUE = 900

/** Danger-state blink animation (matches firmware's red pulse cadence). */
export const BLINK_ANIM = 'canshift-blink 0.7s step-end infinite'

let _blinkStyleInjected = false
/** Lazily inject the @keyframes rule for BLINK_ANIM. Idempotent. */
export function ensureBlinkStyle(): void {
  if (_blinkStyleInjected) return
  _blinkStyleInjected = true
  const el = document.createElement('style')
  el.textContent = '@keyframes canshift-blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }'
  document.head.appendChild(el)
}

// ---------------------------------------------------------------------------
// Zone colours — automotive green/orange/red, used by bar and gauge previews.
// Mirrors firmware bar_widget.cpp and gauge zone tinting; intentionally
// independent of widget.style.primaryColor.
// ---------------------------------------------------------------------------

export const ZONE_NORMAL = '#00CC44'
export const ZONE_WARNING = '#FF8800'
export const ZONE_DANGER = '#FF4444'

/**
 * Pick the active zone colour for a given normalised percentage.
 * `valuePct`, `warnPct`, `dangerPct` are all in [0, 1].
 */
export function zoneColorFor(valuePct: number, warnPct: number, dangerPct: number): string {
  if (valuePct >= dangerPct) return ZONE_DANGER
  if (valuePct >= warnPct) return ZONE_WARNING
  return ZONE_NORMAL
}

// ---------------------------------------------------------------------------
// Semantic per-sensor palette (issue #954)
//
// When a gauge or bar widget pins itself to a known `SensorIconName`, the
// preview fills opaquely in the per-sensor OK colour below `warningLevel`
// and the warning colour above. Sensors with no semantic upper warning
// (throttle, speed) keep the OK colour across the whole range. Unknown
// sensors fall through to the legacy zone palette so widgets without an
// `iconName` keep their existing look.
// ---------------------------------------------------------------------------

/**
 * Resolve the fill colour for a gauge/bar value, given the bound sensor's
 * `iconName`. Returns `undefined` when no sensor is set so the caller can
 * keep its existing fallback path (widget.style.primaryColor / legacy zone
 * tinting).
 */
export function paletteFillColor(
  iconName: SensorIconName | undefined,
  valuePct: number,
  warnPct: number,
  dangerPct: number
): string | undefined {
  const ok = sensorOkColor(iconName)
  if (!ok) return undefined
  const warning = sensorWarningColor(iconName)
  if (warning === undefined) return ok
  if (valuePct >= warnPct || valuePct >= dangerPct) return warning
  return ok
}

// ---------------------------------------------------------------------------
// Threshold percentage helpers
// ---------------------------------------------------------------------------

/** Clamp `(level - min) / range` to [0, 1] without dividing by zero. */
export function thresholdPct(level: number, min: number, max: number): number {
  const range = max - min || 1
  return Math.max(0, Math.min(1, (level - min) / range))
}

// ---------------------------------------------------------------------------
// Label overlay attribute helpers — shared by every renderer that draws a
// user-configured label inside a fixed corner.
// ---------------------------------------------------------------------------

interface SvgLabelAttrs {
  x: number
  y: number
  textAnchor: 'start' | 'middle' | 'end'
  dominantBaseline: 'hanging' | 'auto'
}

/**
 * SVG attributes for a label positioned at one of the six fixed corners.
 * pad mirrors firmware's `kEdgeInsetX` (4 px horizontal inset).
 */
export function svgLabelAttrs(
  pos: WidgetLabelPosition,
  w: number,
  h: number,
  pad = 4
): SvgLabelAttrs {
  const isTop = pos.startsWith('top')
  const isCenter = pos.endsWith('center')
  const isRight = pos.endsWith('right')
  return {
    x: isCenter ? w / 2 : isRight ? w - pad : pad,
    y: isTop ? pad + 6 : h - pad - 1,
    textAnchor: isCenter ? 'middle' : isRight ? 'end' : 'start',
    dominantBaseline: isTop ? 'hanging' : 'auto',
  }
}

/**
 * HTML-side equivalent of svgLabelAttrs — absolute-positioned span style for
 * any of the six corners. Used by HTML-rendered previews (warning, gear, timer).
 */
export function htmlLabelStyle(pos: WidgetLabelPosition, pad = 3): CSSProperties {
  const isTop = pos.startsWith('top')
  const isCenter = pos.endsWith('center')
  const isRight = pos.endsWith('right')
  return {
    position: 'absolute',
    ...(isTop ? { top: pad } : { bottom: pad }),
    ...(isCenter
      ? { left: '50%', transform: 'translateX(-50%)' }
      : isRight
        ? { right: pad }
        : { left: pad }),
    pointerEvents: 'none',
  }
}

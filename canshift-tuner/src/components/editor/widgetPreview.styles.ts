// widgetPreview.styles.ts — Shared visual tokens and helpers used across
// every widget preview renderer. Extracted from WidgetPreview.tsx to keep
// individual renderers focused on their own SVG/HTML structure and to give
// the studio a single place to tweak the cross-widget look.

import { sensorOkColor, sensorWarningColor, type SensorIconName } from '@tmbk/canshift-core'

// ---------------------------------------------------------------------------
// Font + animation tokens
// ---------------------------------------------------------------------------

/** Studio mirrors firmware's compiled-in Orbitron racing display face (#431). */
export const FONT_FAMILY = 'Orbitron, sans-serif'

/** Heavy weight for primary numeric values across previews (matches Orbitron set). */
export const FONT_WEIGHT_VALUE = 900

/** Danger-state blink animation (matches firmware's red pulse cadence). */
export const BLINK_ANIM = 'canshift-blink 0.7s step-end infinite'

/**
 * Raw @keyframes CSS for {@link BLINK_ANIM}. Consumed by the one-shot
 * `useBlinkKeyframes` hook in `App.tsx` so the rule is injected once at
 * mount instead of on every `WidgetPreview` mount (audit follow-up to
 * #1207 — DOM-mutation hygiene).
 */
export const BLINK_KEYFRAMES_CSS =
  '@keyframes canshift-blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }'

// ---------------------------------------------------------------------------
// Zone colours — automotive green/orange/red, used by bar and gauge previews.
// Mirrors firmware bar_widget.cpp and gauge zone tinting; intentionally
// independent of widget.style.primaryColor.
// ---------------------------------------------------------------------------

export const ZONE_NORMAL = '#00CC44'
export const ZONE_DANGER = '#FF4444'

// ---------------------------------------------------------------------------
// Semantic per-sensor palette (issue #954)
//
// When a gauge or bar widget pins itself to a known `SensorIconName`, the
// preview fills opaquely in the per-sensor OK colour below `dangerLevel`
// and the warning colour above. Sensors with no semantic upper warning
// (throttle, speed) keep the OK colour across the whole range. Unknown
// sensors fall through to the legacy zone palette so widgets without an
// `iconName` keep their existing look.
// ---------------------------------------------------------------------------

/**
 * Resolve the fill colour for a gauge/bar value, given the bound sensor's
 * `iconName`. Returns `undefined` when no sensor is set so the caller can
 * keep its existing fallback path (widget.style.primaryColor / legacy zone
 * tinting). Single threshold (issue #965): the warning colour fires at
 * `valuePct >= dangerPct`.
 */
export function paletteFillColor(
  iconName: SensorIconName | undefined,
  valuePct: number,
  dangerPct: number
): string | undefined {
  const ok = sensorOkColor(iconName)
  if (!ok) return undefined
  const warning = sensorWarningColor(iconName)
  if (warning === undefined) return ok
  return valuePct >= dangerPct ? warning : ok
}

// ---------------------------------------------------------------------------
// Threshold percentage helpers
// ---------------------------------------------------------------------------

/** Clamp `(level - min) / range` to [0, 1] without dividing by zero. */
export function thresholdPct(level: number, min: number, max: number): number {
  const range = max - min || 1
  return Math.max(0, Math.min(1, (level - min) / range))
}

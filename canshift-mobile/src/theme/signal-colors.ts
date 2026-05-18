// signal-colors.ts — Per-signal graph line color.
//
// Closes #907. Previously GraphScreen kept a 13-entry hand-rolled palette
// that drifted from the SENSOR_DEFAULT_RAMPS source of truth in
// canshift-core. We now derive a color from the same ramp the firmware /
// studio render for that sensor — adding a new standard sensor in core
// gives mobile a graph color for free.
//
// Compact telemetry keys (r, ct, ot, …) don't trigger the name heuristics
// in resolveDefaultRamp directly, so we explicit-map them to SensorKind
// here. Keys outside the standard sensor catalog (tps, fp, s, g, map, bat)
// keep a small mobile-only palette — they're chart legibility colors, not
// sensor-semantic ones.

import { SENSOR_DEFAULT_RAMPS, colorAtValue, type SensorKind } from '@tmbk/canshift-core'

/**
 * Compact telemetry key → canshift-core SensorKind. Only entries where the
 * mobile key truly is one of the standard sensor catalog kinds. Other keys
 * (tps, map, fp, s, g, bat) fall through to FALLBACK_COLOR.
 */
const KEY_TO_SENSOR_KIND: Record<string, SensorKind> = {
  r: 'rpm',
  ct: 'coolant_temp',
  ot: 'oil_temp',
  op: 'oil_press',
  iat: 'intake_temp',
  bst: 'boost',
  lam: 'afr',
}

/**
 * Chart-line colors for compact keys outside the standard sensor catalog.
 * Each value is chosen for graph legibility — they do not carry any
 * health/danger semantics like the SENSOR_DEFAULT_RAMPS colors do.
 */
const FALLBACK_COLOR: Record<string, string> = {
  tps: '#FFD700',
  map: '#44AAFF',
  fp: '#FF88BB',
  s: '#CCCCCC',
  g: '#888888',
  bat: '#AAFFAA',
}

/** Used when a key has no SensorKind mapping and no fallback entry. */
const DEFAULT_COLOR = '#888888'

/**
 * Resolve a graph line color for a compact telemetry key. For keys mapped
 * to a SensorKind, sample the standard ramp at its midpoint value so the
 * line color matches the gauge color in the green/healthy band of the
 * sensor's operating range.
 */
export function getSignalColor(key: string): string {
  const kind = KEY_TO_SENSOR_KIND[key]
  if (kind) {
    const ramp = SENSOR_DEFAULT_RAMPS[kind]
    const first = ramp.stops[0]
    const last = ramp.stops[ramp.stops.length - 1]
    if (first && last) {
      return colorAtValue(ramp, (first.value + last.value) / 2)
    }
  }
  return FALLBACK_COLOR[key] ?? DEFAULT_COLOR
}

// sensor-palette.ts — Semantic per-sensor 2-zone colour palette (issue #954).
//
// Each `SensorIconName` resolves to an "OK zone" colour matching the metric
// (water blue for coolant, violet for turbo boost, etc.) and an optional
// "warning zone" colour. The palette is the single source of truth for the
// Studio gauge preview, the firmware widget renderers (mirrored as a C++
// table in canshift-firmware/src/ui/sensor_palette.cpp) and the mobile app.
//
// Design rules locked in by the issue:
//   - Exactly two zones per gauge — no multi-stop gradients (kept in
//     `sensor-defaults.ts` for the legacy ramp path).
//   - The OK colour is opaque; the value fill grows from min toward max in
//     that colour and flips to the warning colour above `warningLevel`.
//   - A missing or unknown `iconName` falls back to the widget's
//     `style.primaryColor` (legacy override) — never silently overrides a
//     hand-picked colour.

import type { HexColor } from './schemas/common.js'
import type { SensorIconName } from './schemas/dashboard.js'

export interface SensorPaletteEntry {
  /** Colour used when value < warningLevel. Always defined. */
  ok: HexColor
  /**
   * Colour used when value >= warningLevel. Absent for sensors whose upper
   * range has no semantic warning (throttle position, vehicle speed) — the
   * gauge keeps the OK colour across the whole range in that case.
   */
  warning?: HexColor
}

const RED: HexColor = '#CC3333'
const AMBER: HexColor = '#FFA000'

/**
 * Per-sensor colour palette. Keys MUST stay in lockstep with
 * `SensorIconName` (Zod enum in `schemas/dashboard.ts`) — the firmware
 * mirror table in `canshift-firmware/src/ui/sensor_palette.cpp` indexes by
 * the same string key.
 */
export const SENSOR_PALETTE: Record<SensorIconName, SensorPaletteEntry> = {
  // Engine fluids & pressures
  coolant: { ok: '#1E88E5', warning: RED },
  oil_temp: { ok: '#F5A623', warning: RED },
  oil_pressure: { ok: '#4CAF50', warning: RED },
  // Forced induction
  boost: { ok: '#8E24AA', warning: RED },
  turbo: { ok: '#8E24AA', warning: RED },
  // Electrical
  battery: { ok: '#FBC02D', warning: RED },
  // Fuel — warns AMBER for low fuel, not red (low fuel ≠ engine danger).
  fuel: { ok: '#4CAF50', warning: AMBER },
  afr: { ok: '#C2185B', warning: RED },
  // Engine speed
  rpm: { ok: '#00ACC1', warning: RED },
  // Throttle & speed — no semantic upper warning.
  throttle: { ok: '#FB8C00' },
  speed: { ok: '#ECEFF1' },
  // Intake / exhaust temps
  iat: { ok: '#4FC3F7', warning: RED },
  exhaust: { ok: '#FB8C00', warning: RED },
  // Indicators / status — neutral OK colour; warning glyph stays red.
  gear: { ok: '#ECEFF1' },
  timer: { ok: '#ECEFF1' },
  warning: { ok: RED },
  flame: { ok: '#FF6F00', warning: RED },
  engine: { ok: '#4CAF50', warning: RED },
  brake: { ok: RED },
  launch: { ok: '#43A047' },
  traction: { ok: '#43A047' },
  map_icon: { ok: '#42A5F5' },
  cog: { ok: '#9E9E9E' },
}

/**
 * Resolve the OK-zone colour for a sensor. Returns `undefined` when
 * `iconName` is missing — callers fall back to `style.primaryColor` so
 * legacy configs with a hand-picked colour keep their override.
 */
export function sensorOkColor(iconName: SensorIconName | undefined): HexColor | undefined {
  if (!iconName) return undefined
  return SENSOR_PALETTE[iconName].ok
}

/**
 * Resolve the warning-zone colour. `undefined` means the sensor has no
 * upper warning (callers keep the OK colour above the threshold).
 */
export function sensorWarningColor(iconName: SensorIconName | undefined): HexColor | undefined {
  if (!iconName) return undefined
  return SENSOR_PALETTE[iconName].warning
}

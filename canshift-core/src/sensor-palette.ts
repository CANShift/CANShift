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

import { HexColorSchema } from './schemas/common.js'
import type { HexColor } from './schemas/common.js'
import type { SensorIconName } from './schemas/dashboard.js'
import type { SignalType } from './schemas/signal-type.js'

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

// Branded `HexColor` is nominal — plain hex literals must flow through the
// schema once at module load (#1207 brand follow-up to #1316). Cheap one-shot
// cost; a typo in the canonical palette trips Zod here rather than producing
// confusing runtime drift downstream.
const hex = (value: string): HexColor => HexColorSchema.parse(value)

const RED = hex('#CC3333')
const AMBER = hex('#FFA000')

/**
 * Per-sensor colour palette. Keys MUST stay in lockstep with
 * `SensorIconName` (Zod enum in `schemas/dashboard.ts`) — the firmware
 * mirror table in `canshift-firmware/src/ui/sensor_palette.cpp` indexes by
 * the same string key.
 */
export const SENSOR_PALETTE: Record<SensorIconName, SensorPaletteEntry> = {
  // Engine fluids & pressures
  coolant: { ok: hex('#1E88E5'), warning: RED },
  oil_temp: { ok: hex('#F5A623'), warning: RED },
  oil_pressure: { ok: hex('#4CAF50'), warning: RED },
  // Forced induction
  boost: { ok: hex('#8E24AA'), warning: RED },
  turbo: { ok: hex('#8E24AA'), warning: RED },
  // Electrical
  battery: { ok: hex('#FBC02D'), warning: RED },
  // Fuel — warns AMBER for low fuel, not red (low fuel ≠ engine danger).
  fuel: { ok: hex('#4CAF50'), warning: AMBER },
  afr: { ok: hex('#C2185B'), warning: RED },
  // Engine speed
  rpm: { ok: hex('#00ACC1'), warning: RED },
  // Throttle & speed — no semantic upper warning.
  throttle: { ok: hex('#FB8C00') },
  speed: { ok: hex('#ECEFF1') },
  // Intake / exhaust temps
  iat: { ok: hex('#4FC3F7'), warning: RED },
  exhaust: { ok: hex('#FB8C00'), warning: RED },
  // Indicators / status — neutral OK colour; warning glyph stays red.
  gear: { ok: hex('#ECEFF1') },
  timer: { ok: hex('#ECEFF1') },
  warning: { ok: RED },
  flame: { ok: hex('#FF6F00'), warning: RED },
  engine: { ok: hex('#4CAF50'), warning: RED },
  brake: { ok: RED },
  launch: { ok: hex('#43A047') },
  traction: { ok: hex('#43A047') },
  map_icon: { ok: hex('#42A5F5') },
  cog: { ok: hex('#9E9E9E') },
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

/**
 * Resolve the OK-zone colour from a signal type. The signal-type names are a
 * subset of {@link SensorIconName} (the icon enum carries extra glyphs like
 * `gear` / `timer` that aren't signal categories) so the lookup defers to
 * the sensor palette. `undefined` is returned for missing or `generic`
 * types — callers fall back to the widget's hand-picked colour.
 */
export function signalTypeOkColor(type: SignalType | undefined): HexColor | undefined {
  if (!type || type === 'generic') return undefined
  // `SignalType` minus `generic` is a subset of `SensorIconName`, so the
  // cast lookup is always defined — the lint rule confirms the chain is
  // unnecessary on a non-nullish value.
  return SENSOR_PALETTE[type as SensorIconName].ok
}

/**
 * Resolve the warning-zone colour from a signal type. Mirrors
 * {@link sensorWarningColor} but keyed off the signal-type enum so widgets
 * don't need a per-widget `iconName` to get danger flashing.
 */
export function signalTypeWarningColor(type: SignalType | undefined): HexColor | undefined {
  if (!type || type === 'generic') return undefined
  return SENSOR_PALETTE[type as SensorIconName].warning
}

// sensor-defaults.ts — Built-in color ramps for the standard sensor catalog
// (issue #430). Keeps firmware and studio in lockstep on the visual semantics
// of common gauges (green / amber / red) without forcing the user to define a
// ramp on every signal. The C++ table in
// canshift-firmware/src/ui/sensor_color_ramp.cpp mirrors these values byte-for-
// byte; the parity is enforced by an anchor test against the JSON fixture
// emitted by `npm run export:sensor-defaults`.

import { HEX_REGEX } from './colors/hex.js'
import type { HexColor } from './schemas/common.js'
import type { ColorRamp } from './schemas/signal.js'

/**
 * Discriminated kinds for the standard sensor catalog. The string values are
 * stable identifiers — keep in sync with the C++ `SensorKind` enum in
 * canshift-firmware/src/ui/sensor_color_ramp.h. Extending this list requires
 * a matching firmware change AND a new entry in `SENSOR_DEFAULT_RAMPS`.
 */
export type SensorKind =
  | 'coolant_temp'
  | 'oil_temp'
  | 'oil_press'
  | 'battery_volts'
  | 'rpm'
  | 'afr'
  | 'boost'
  | 'intake_temp'
  | 'egt'

/**
 * Default ramps shipped with the firmware. Values use the signal's native
 * unit (°C for temperatures, bar for pressures, V for voltages, RPM, etc.).
 *
 * Color choices follow racing convention: blue/green = healthy, amber =
 * watch, red = danger. Battery and AFR alarm in BOTH directions — the ramp
 * goes red on either end with a green plateau in the middle.
 *
 * SAFETY NOTE: thresholds are sane defaults for a typical petrol engine, but
 * every engine has its own target windows — users override per signal in the
 * studio editor. A wrong AFR ramp on a different platform is a tuning aid,
 * not a fault detector.
 */
export const SENSOR_DEFAULT_RAMPS: Record<SensorKind, ColorRamp> = {
  coolant_temp: {
    interpolate: 'linear',
    stops: [
      { value: 60, color: '#4A90E2' },
      { value: 90, color: '#44CC66' },
      { value: 100, color: '#CC8800' },
      { value: 110, color: '#CC3333' },
    ],
  },
  oil_temp: {
    interpolate: 'linear',
    stops: [
      { value: 70, color: '#4A90E2' },
      { value: 95, color: '#44CC66' },
      { value: 120, color: '#CC8800' },
      { value: 135, color: '#CC3333' },
    ],
  },
  oil_press: {
    interpolate: 'linear',
    stops: [
      { value: 1.0, color: '#CC3333' },
      { value: 1.8, color: '#CC8800' },
      { value: 2.5, color: '#44CC66' },
      { value: 6.0, color: '#44CC66' },
    ],
  },
  battery_volts: {
    interpolate: 'linear',
    stops: [
      { value: 11.5, color: '#CC3333' },
      { value: 12.5, color: '#CC8800' },
      { value: 13.5, color: '#44CC66' },
      { value: 14.8, color: '#CC8800' },
      { value: 15.5, color: '#CC3333' },
    ],
  },
  rpm: {
    interpolate: 'linear',
    stops: [
      { value: 1500, color: '#44CC66' },
      { value: 5500, color: '#44CC66' },
      { value: 6500, color: '#CC8800' },
      { value: 7000, color: '#CC3333' },
    ],
  },
  afr: {
    interpolate: 'linear',
    stops: [
      { value: 10.5, color: '#CC3333' },
      { value: 11.8, color: '#CC8800' },
      { value: 13.0, color: '#44CC66' },
      { value: 14.7, color: '#44CC66' },
      { value: 16.0, color: '#CC8800' },
    ],
  },
  boost: {
    interpolate: 'linear',
    stops: [
      { value: 0.0, color: '#44CC66' },
      { value: 1.0, color: '#44CC66' },
      { value: 1.4, color: '#CC8800' },
      { value: 1.7, color: '#CC3333' },
    ],
  },
  intake_temp: {
    interpolate: 'linear',
    stops: [
      { value: 20, color: '#44CC66' },
      { value: 50, color: '#CC8800' },
      { value: 65, color: '#CC3333' },
    ],
  },
  egt: {
    interpolate: 'linear',
    stops: [
      { value: 600, color: '#44CC66' },
      { value: 850, color: '#CC8800' },
      { value: 950, color: '#CC3333' },
    ],
  },
}

/**
 * Heuristic mapping from a signal name (as written in `signals.json`) to the
 * built-in `SensorKind`. Returns `undefined` when no rule matches — callers
 * fall back to the static color path.
 *
 * Ordering matters: more specific patterns (e.g. "oil_press") MUST come
 * before broader ones (e.g. "oil"). The C++ port (`sensorKindFromName`)
 * mirrors this list in the same order.
 */
const NAME_HEURISTICS: readonly { pattern: string; kind: SensorKind }[] = [
  { pattern: 'coolant', kind: 'coolant_temp' },
  { pattern: 'oil_press', kind: 'oil_press' },
  { pattern: 'oil_pressure', kind: 'oil_press' },
  { pattern: 'oil_temp', kind: 'oil_temp' },
  { pattern: 'oil', kind: 'oil_temp' },
  { pattern: 'battery', kind: 'battery_volts' },
  { pattern: 'batt_v', kind: 'battery_volts' },
  { pattern: 'rpm', kind: 'rpm' },
  { pattern: 'afr', kind: 'afr' },
  { pattern: 'lambda', kind: 'afr' },
  { pattern: 'boost', kind: 'boost' },
  { pattern: 'manifold_press', kind: 'boost' },
  { pattern: 'map_press', kind: 'boost' },
  { pattern: 'intake_temp', kind: 'intake_temp' },
  { pattern: 'iat', kind: 'intake_temp' },
  { pattern: 'mat', kind: 'intake_temp' },
  { pattern: 'egt', kind: 'egt' },
  { pattern: 'exhaust_temp', kind: 'egt' },
]

/**
 * Resolve a default ramp from a free-form signal name. Pure substring match
 * on the lower-cased name; matching follows the order in `NAME_HEURISTICS`
 * so more specific patterns win.
 */
export function resolveDefaultRamp(signalName: string): ColorRamp | undefined {
  const kind = resolveSensorKind(signalName)
  return kind ? SENSOR_DEFAULT_RAMPS[kind] : undefined
}

/**
 * Resolve only the `SensorKind` (no ramp lookup). Exposed so the studio editor
 * can offer a "Reset to defaults" button keyed on the signal name.
 */
export function resolveSensorKind(signalName: string): SensorKind | undefined {
  const lowered = signalName.toLowerCase()
  for (const { pattern, kind } of NAME_HEURISTICS) {
    if (lowered.includes(pattern)) return kind
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Color sampling
// ---------------------------------------------------------------------------

interface RgbChannels {
  r: number
  g: number
  b: number
}

function parseHex(color: HexColor): RgbChannels {
  const m = HEX_REGEX.exec(color)
  if (!m) return { r: 0, g: 0, b: 0 }
  const n = Number.parseInt(m[1] ?? '000000', 16)
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff }
}

function toHex(channels: RgbChannels): HexColor {
  const clamp = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v))
  const hex = (v: number): string => clamp(v).toString(16).padStart(2, '0').toUpperCase()
  return `#${hex(channels.r)}${hex(channels.g)}${hex(channels.b)}`
}

/**
 * Sample a `ColorRamp` at `value`. O(stops), no allocation beyond the
 * returned hex string. Below the first stop returns the first color; above
 * the last stop returns the last color. Single-stop ramps are clamped to
 * that color (the validator forbids them, but be defensive at runtime).
 */
export function colorAtValue(ramp: ColorRamp, value: number): HexColor {
  const stops = ramp.stops
  if (stops.length === 0) return '#000000'
  const first = stops[0]
  const last = stops[stops.length - 1]
  if (!first || !last) return '#000000'
  if (stops.length === 1 || value <= first.value) return first.color
  if (value >= last.value) return last.color

  // Step mode: a stop at `v` with color C means "from v onward, until the
  // next stop, color is C". Exact-match on a stop value picks that stop's
  // color (i.e. the upper-bound stop wins on the boundary).
  if (ramp.interpolate === 'step') {
    let active = first.color
    for (const stop of stops) {
      if (value >= stop.value) active = stop.color
      else break
    }
    return active
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const lower = stops[i]
    const upper = stops[i + 1]
    if (!lower || !upper) continue
    if (value >= lower.value && value <= upper.value) {
      const span = upper.value - lower.value
      const t = span > 0 ? (value - lower.value) / span : 0
      const a = parseHex(lower.color)
      const b = parseHex(upper.color)
      return toHex({
        r: a.r + (b.r - a.r) * t,
        g: a.g + (b.g - a.g) * t,
        b: a.b + (b.b - a.b) * t,
      })
    }
  }

  return last.color
}

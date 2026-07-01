import { HEX_REGEX } from './colors/hex.js'
import { HexColorSchema } from './schemas/common.js'
import type { HexColor } from './schemas/common.js'
import type { ColorRamp } from './schemas/signal.js'
import type { SensorIconName } from './schemas/widgets/sensor-icon.js'

const hex = (value: string): HexColor => HexColorSchema.parse(value)

export const SENSOR_KINDS = [
  'coolant_temp',
  'oil_temp',
  'oil_press',
  'battery_volts',
  'rpm',
  'afr',
  'boost',
  'intake_temp',
  'egt',
] as const

export type SensorKind = (typeof SENSOR_KINDS)[number]

export const SENSOR_KIND_TO_ICON: Record<SensorKind, SensorIconName> = {
  coolant_temp: 'coolant',
  oil_temp: 'oil_temp',
  oil_press: 'oil_pressure',
  battery_volts: 'battery',
  rpm: 'rpm',
  afr: 'afr',
  boost: 'boost',
  intake_temp: 'iat',
  egt: 'exhaust',
}

export const SENSOR_DEFAULT_RAMPS: Record<SensorKind, ColorRamp> = {
  coolant_temp: {
    interpolate: 'linear',
    stops: [
      { value: 60, color: hex('#4A90E2') },
      { value: 90, color: hex('#44CC66') },
      { value: 100, color: hex('#CC8800') },
      { value: 110, color: hex('#CC3333') },
    ],
  },
  oil_temp: {
    interpolate: 'linear',
    stops: [
      { value: 70, color: hex('#4A90E2') },
      { value: 95, color: hex('#44CC66') },
      { value: 120, color: hex('#CC8800') },
      { value: 135, color: hex('#CC3333') },
    ],
  },
  oil_press: {
    interpolate: 'linear',
    stops: [
      { value: 1.0, color: hex('#CC3333') },
      { value: 1.8, color: hex('#CC8800') },
      { value: 2.5, color: hex('#44CC66') },
      { value: 6.0, color: hex('#44CC66') },
    ],
  },
  battery_volts: {
    interpolate: 'linear',
    stops: [
      { value: 11.5, color: hex('#CC3333') },
      { value: 12.5, color: hex('#CC8800') },
      { value: 13.5, color: hex('#44CC66') },
      { value: 14.8, color: hex('#CC8800') },
      { value: 15.5, color: hex('#CC3333') },
    ],
  },
  rpm: {
    interpolate: 'linear',
    stops: [
      { value: 1500, color: hex('#44CC66') },
      { value: 5500, color: hex('#44CC66') },
      { value: 6500, color: hex('#CC8800') },
      { value: 7000, color: hex('#CC3333') },
    ],
  },
  afr: {
    interpolate: 'linear',
    stops: [
      { value: 10.5, color: hex('#CC3333') },
      { value: 11.8, color: hex('#CC8800') },
      { value: 13.0, color: hex('#44CC66') },
      { value: 14.7, color: hex('#44CC66') },
      { value: 16.0, color: hex('#CC8800') },
    ],
  },
  boost: {
    interpolate: 'linear',
    stops: [
      { value: 0.0, color: hex('#44CC66') },
      { value: 1.0, color: hex('#44CC66') },
      { value: 1.4, color: hex('#CC8800') },
      { value: 1.7, color: hex('#CC3333') },
    ],
  },
  intake_temp: {
    interpolate: 'linear',
    stops: [
      { value: 20, color: hex('#44CC66') },
      { value: 50, color: hex('#CC8800') },
      { value: 65, color: hex('#CC3333') },
    ],
  },
  egt: {
    interpolate: 'linear',
    stops: [
      { value: 600, color: hex('#44CC66') },
      { value: 850, color: hex('#CC8800') },
      { value: 950, color: hex('#CC3333') },
    ],
  },
}

interface RgbChannels {
  r: number
  g: number
  b: number
}

const parseHex = (color: HexColor): RgbChannels => {
  const m = HEX_REGEX.exec(color)
  if (!m) return { r: 0, g: 0, b: 0 }
  const n = Number.parseInt(m[1] ?? '000000', 16)
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff }
}

const BLACK = hex('#000000')

const toHex = (channels: RgbChannels): HexColor => {
  const clamp = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v))
  const byte = (v: number): string => clamp(v).toString(16).padStart(2, '0').toUpperCase()
  return hex(`#${byte(channels.r)}${byte(channels.g)}${byte(channels.b)}`)
}

export const colorAtValue = (ramp: ColorRamp, value: number): HexColor => {
  const stops = ramp.stops
  if (stops.length === 0) return BLACK
  const first = stops[0]
  const last = stops[stops.length - 1]
  if (!first || !last) return BLACK
  if (stops.length === 1 || value <= first.value) return first.color
  if (value >= last.value) return last.color

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

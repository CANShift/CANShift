import {
  SENSOR_DEFAULT_RAMPS,
  SENSOR_KINDS,
  SENSOR_KIND_TO_ICON,
  colorAtValue,
} from '../sensor-defaults.js'
import type { SensorKind } from '../sensor-defaults.js'
import { SENSOR_PALETTE } from '../sensor-palette.js'
import { HEX_REGEX } from '../colors/hex.js'
import { MAX_RAMP_STOPS } from '../constants/firmware-caps.js'
import { HexColorSchema } from '../schemas/common.js'
import type { ColorRamp } from '../schemas/signal.js'

const hex = (value: string): ReturnType<typeof HexColorSchema.parse> => HexColorSchema.parse(value)

describe('SENSOR_DEFAULT_RAMPS', () => {
  const entries = Object.entries(SENSOR_DEFAULT_RAMPS) as [
    SensorKind,
    (typeof SENSOR_DEFAULT_RAMPS)[SensorKind],
  ][]

  it.each(entries)('%s has 2..MAX stops, sorted ascending, valid hex', (_kind, ramp) => {
    expect(ramp.stops.length).toBeGreaterThanOrEqual(2)
    expect(ramp.stops.length).toBeLessThanOrEqual(MAX_RAMP_STOPS)

    for (let i = 1; i < ramp.stops.length; i++) {
      expect(ramp.stops[i]!.value).toBeGreaterThan(ramp.stops[i - 1]!.value)
    }

    for (const stop of ramp.stops) {
      expect(HEX_REGEX.test(stop.color)).toBe(true)
    }
  })

  it('uses linear interpolation for every shipped sensor', () => {
    for (const ramp of Object.values(SENSOR_DEFAULT_RAMPS)) {
      expect(ramp.interpolate).toBe('linear')
    }
  })
})

describe('SENSOR_KINDS / SENSOR_KIND_TO_ICON', () => {
  it('covers every kind with a default ramp', () => {
    expect(Object.keys(SENSOR_DEFAULT_RAMPS).sort()).toEqual([...SENSOR_KINDS].sort())
  })

  it('maps every kind to an icon backed by the sensor palette', () => {
    for (const kind of SENSOR_KINDS) {
      const icon = SENSOR_KIND_TO_ICON[kind]
      expect(SENSOR_PALETTE[icon]).toBeDefined()
    }
  })
})

describe('colorAtValue', () => {
  const ramp = SENSOR_DEFAULT_RAMPS.coolant_temp

  it('clamps below the first stop to the first color', () => {
    expect(colorAtValue(ramp, 30)).toBe(ramp.stops[0]!.color)
  })

  it('clamps above the last stop to the last color', () => {
    expect(colorAtValue(ramp, 200)).toBe(ramp.stops[ramp.stops.length - 1]!.color)
  })

  it('returns the exact stop color when value matches a stop', () => {
    expect(colorAtValue(ramp, 90)).toBe('#44CC66')
  })

  it('lerps channel-wise between two stops in linear mode', () => {
    const out = colorAtValue(ramp, 95)
    expect(out).toBe('#88AA33')
  })

  it('returns the lower stop color for the entire segment in step mode', () => {
    const stepRamp: ColorRamp = {
      interpolate: 'step',
      stops: [
        { value: 0, color: hex('#44CC66') },
        { value: 50, color: hex('#CC8800') },
        { value: 100, color: hex('#CC3333') },
      ],
    }
    expect(colorAtValue(stepRamp, 25)).toBe('#44CC66')
    expect(colorAtValue(stepRamp, 49.99)).toBe('#44CC66')
    expect(colorAtValue(stepRamp, 50)).toBe('#CC8800')
    expect(colorAtValue(stepRamp, 75)).toBe('#CC8800')
    expect(colorAtValue(stepRamp, 100)).toBe('#CC3333')
  })
})

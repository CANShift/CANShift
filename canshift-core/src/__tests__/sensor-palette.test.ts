// sensor-palette.test.ts — Lock the two-zone palette table shape (issue #954).
//
// The palette crosses the firmware/studio/mobile boundary, so we pin the
// shape invariants (valid hex, key coverage) and the resolver fallback
// contract here. Drift from the C++ mirror is caught by the firmware
// native test against the JSON fixture.

import {
  SENSOR_PALETTE,
  sensorOkColor,
  sensorWarningColor,
} from '../sensor-palette.js'
import { SensorIconNameSchema } from '../schemas/dashboard.js'
import { HEX_COLOR_REGEX } from '../constants/firmware-caps.js'

describe('SENSOR_PALETTE', () => {
  const entries = Object.entries(SENSOR_PALETTE)

  it('covers every SensorIconName enum value', () => {
    const expected = SensorIconNameSchema.options.slice().sort()
    const actual = Object.keys(SENSOR_PALETTE).sort()
    expect(actual).toEqual(expected)
  })

  it.each(entries)('%s has valid hex colours', (_name, entry) => {
    expect(entry.ok).toMatch(HEX_COLOR_REGEX)
    if (entry.warning !== undefined) {
      expect(entry.warning).toMatch(HEX_COLOR_REGEX)
    }
  })
})

describe('sensorOkColor', () => {
  it('returns the palette OK colour for a known sensor', () => {
    expect(sensorOkColor('coolant')).toBe('#1E88E5')
    expect(sensorOkColor('boost')).toBe('#8E24AA')
  })

  it('returns undefined when iconName is missing', () => {
    expect(sensorOkColor(undefined)).toBeUndefined()
  })
})

describe('sensorWarningColor', () => {
  it('returns the palette warning colour when defined', () => {
    expect(sensorWarningColor('coolant')).toBe('#CC3333')
  })

  it('returns undefined for sensors with no semantic warning', () => {
    expect(sensorWarningColor('throttle')).toBeUndefined()
    expect(sensorWarningColor('speed')).toBeUndefined()
  })

  it('returns undefined when iconName is missing', () => {
    expect(sensorWarningColor(undefined)).toBeUndefined()
  })
})

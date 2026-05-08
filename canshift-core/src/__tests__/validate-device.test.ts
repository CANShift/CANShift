// validate-device.test.ts

import { validateDevice } from '../validation/validate-device.js'

function minimalDevice(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    can_speed_kbps: 500,
    twai_tx_pin: 22,
    twai_rx_pin: 21,
    ...overrides,
  }
}

describe('validateDevice', () => {
  it('accepts the firmware default device config', () => {
    const result = validateDevice(minimalDevice())
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })

  it('rejects non-object input', () => {
    expect(validateDevice(null).valid).toBe(false)
    expect(validateDevice(42).valid).toBe(false)
    expect(validateDevice('string').valid).toBe(false)
    expect(validateDevice(undefined).valid).toBe(false)
    expect(validateDevice([]).valid).toBe(false)
  })

  describe('can_speed_kbps', () => {
    it('rejects unsupported speeds', () => {
      const r = validateDevice(minimalDevice({ can_speed_kbps: 800 }))
      expect(r.errors.some((e) => e.includes('can_speed_kbps'))).toBe(true)
    })

    it('rejects non-integer speeds', () => {
      const r = validateDevice(minimalDevice({ can_speed_kbps: '500' }))
      expect(r.errors.some((e) => e.includes('can_speed_kbps'))).toBe(true)
    })

    it('accepts every supported CAN speed', () => {
      for (const speed of [125, 250, 500, 1000]) {
        const r = validateDevice(minimalDevice({ can_speed_kbps: speed }))
        expect(r.errors.filter((e) => e.includes('can_speed_kbps'))).toEqual([])
      }
    })
  })

  describe('GPIO pins', () => {
    it('rejects pins outside [0, 39]', () => {
      const negative = validateDevice(minimalDevice({ twai_tx_pin: -1 }))
      expect(negative.errors.some((e) => e.includes('twai_tx_pin'))).toBe(true)

      const high = validateDevice(minimalDevice({ twai_tx_pin: 40 }))
      expect(high.errors.some((e) => e.includes('twai_tx_pin'))).toBe(true)
    })

    it('rejects non-integer pins', () => {
      const r = validateDevice(minimalDevice({ twai_rx_pin: 21.5 }))
      expect(r.errors.some((e) => e.includes('twai_rx_pin'))).toBe(true)
    })

    it('rejects SPI-flash-reserved pins (6-11)', () => {
      for (const pin of [6, 7, 8, 9, 10, 11]) {
        const r = validateDevice(minimalDevice({ twai_tx_pin: pin }))
        expect(r.errors.some((e) => e.includes('SPI-flash-reserved'))).toBe(true)
      }
    })

    it('rejects identical TX and RX pins', () => {
      const r = validateDevice(minimalDevice({ twai_tx_pin: 21, twai_rx_pin: 21 }))
      expect(r.errors.some((e) => e.includes('must be different GPIOs'))).toBe(true)
    })

    it('warns when TX uses an input-only GPIO', () => {
      const r = validateDevice(minimalDevice({ twai_tx_pin: 34 }))
      expect(r.errors.filter((e) => e.includes('twai_tx_pin'))).toEqual([])
      expect(r.warnings.some((w) => w.includes('input-only GPIO 34'))).toBe(true)
    })

    it('does not warn for output-capable GPIOs', () => {
      const r = validateDevice(minimalDevice({ twai_tx_pin: 22 }))
      expect(r.warnings).toHaveLength(0)
    })
  })

  it('accumulates all errors rather than stopping at first', () => {
    const result = validateDevice({
      can_speed_kbps: 0,
      twai_tx_pin: -1,
      twai_rx_pin: 99,
    })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(3)
  })
})

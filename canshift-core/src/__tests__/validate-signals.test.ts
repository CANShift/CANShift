// validate-signals.test.ts

import { validateSignals } from '../validation/validate-signals.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function minimalSignal(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'rpm',
    canFrameId: '0x370',
    startByte: 0,
    byteLength: 2,
    bigEndian: true,
    signed: false,
    scale: 1,
    offset: 0,
    unit: 'rpm',
    min: 0,
    max: 8000,
    timeoutMs: 500,
    ...overrides,
  }
}

function minimalConfig(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: '1.0.0',
    protocol: 'maxxecu_v1.2',
    canSpeedKbps: 500,
    signals: [minimalSignal()],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Top-level validation
// ---------------------------------------------------------------------------

describe('validateSignals — top-level fields', () => {
  it('accepts a minimal valid config', () => {
    const result = validateSignals(minimalConfig())
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects non-object input', () => {
    expect(validateSignals(null).valid).toBe(false)
    expect(validateSignals(42).valid).toBe(false)
    expect(validateSignals('string').valid).toBe(false)
    expect(validateSignals(undefined).valid).toBe(false)
    expect(validateSignals([]).valid).toBe(false)
  })

  it('requires version to be a non-empty string', () => {
    const noVersion = validateSignals(minimalConfig({ version: undefined }))
    expect(noVersion.errors).toContain('Missing required field: version')

    const emptyVersion = validateSignals(minimalConfig({ version: '' }))
    expect(emptyVersion.errors).toContain('Missing required field: version')
  })

  it('requires protocol to be a non-empty string', () => {
    const result = validateSignals(minimalConfig({ protocol: '' }))
    expect(result.errors).toContain('Missing required field: protocol')
  })

  it('requires canSpeedKbps to be one of CAN_SPEED_OPTIONS', () => {
    const invalid = validateSignals(minimalConfig({ canSpeedKbps: 999 }))
    expect(invalid.errors.some((e) => e.includes('canSpeedKbps'))).toBe(true)

    const string = validateSignals(minimalConfig({ canSpeedKbps: '500' }))
    expect(string.errors.some((e) => e.includes('canSpeedKbps'))).toBe(true)

    for (const speed of [125, 250, 500, 1000]) {
      const result = validateSignals(minimalConfig({ canSpeedKbps: speed }))
      expect(result.errors.some((e) => e.includes('canSpeedKbps'))).toBe(false)
    }
  })

  it('requires signals to be an array', () => {
    const result = validateSignals(minimalConfig({ signals: 'oops' }))
    expect(result.errors).toContain('signals must be an array')
  })

  it('accepts an empty signals array', () => {
    const result = validateSignals(minimalConfig({ signals: [] }))
    expect(result.valid).toBe(true)
  })

  it('rejects too many signals (over MAX_SIGNALS)', () => {
    const many = Array.from({ length: 33 }, (_, i) => minimalSignal({ name: `s${i.toString()}` }))
    const result = validateSignals(minimalConfig({ signals: many }))
    expect(result.errors.some((e) => e.includes('too many entries'))).toBe(true)
  })

  it('rejects duplicate signal names', () => {
    const result = validateSignals(
      minimalConfig({
        signals: [minimalSignal({ name: 'rpm' }), minimalSignal({ name: 'rpm' })],
      })
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('duplicate signal name "rpm"'))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Per-signal validation
// ---------------------------------------------------------------------------

describe('validateSignals — per-signal fields', () => {
  it('rejects a non-object signal entry', () => {
    const result = validateSignals(minimalConfig({ signals: ['oops'] }))
    expect(result.errors.some((e) => e.includes('signals[0] must be an object'))).toBe(true)
  })

  it('requires signal.name to be a non-empty string', () => {
    const r1 = validateSignals(minimalConfig({ signals: [minimalSignal({ name: '' })] }))
    expect(r1.errors.some((e) => e.includes('name is required'))).toBe(true)

    const r2 = validateSignals(minimalConfig({ signals: [minimalSignal({ name: 42 })] }))
    expect(r2.errors.some((e) => e.includes('name is required'))).toBe(true)
  })

  describe('canFrameId', () => {
    it('rejects non-string', () => {
      const r = validateSignals(minimalConfig({ signals: [minimalSignal({ canFrameId: 0x370 })] }))
      expect(r.errors.some((e) => e.includes('canFrameId must be a hex string'))).toBe(true)
    })

    it('rejects malformed hex strings', () => {
      const r = validateSignals(minimalConfig({ signals: [minimalSignal({ canFrameId: '370' })] }))
      expect(r.errors.some((e) => e.includes('canFrameId must match'))).toBe(true)
    })

    it('rejects values exceeding the 29-bit extended ID max', () => {
      const r = validateSignals(
        minimalConfig({ signals: [minimalSignal({ canFrameId: '0x20000000' })] })
      )
      expect(r.errors.some((e) => e.includes('canFrameId must be in'))).toBe(true)
    })

    it('accepts standard (≤0x7FF) and extended (≤0x1FFFFFFF) IDs', () => {
      for (const id of ['0x000', '0x7FF', '0x800', '0x1FFFFFFF', '0x1fffffff']) {
        const r = validateSignals(minimalConfig({ signals: [minimalSignal({ canFrameId: id })] }))
        expect(r.errors.filter((e) => e.includes('canFrameId'))).toEqual([])
      }
    })
  })

  describe('byte layout', () => {
    it('rejects byteLength outside {1, 2, 4}', () => {
      for (const len of [0, 3, 5, 8, -1, 1.5]) {
        const r = validateSignals(minimalConfig({ signals: [minimalSignal({ byteLength: len })] }))
        expect(r.errors.some((e) => e.includes('byteLength must be one of'))).toBe(true)
      }
    })

    it('rejects startByte outside [0, 7]', () => {
      for (const start of [-1, 8, 9, 1.5]) {
        const r = validateSignals(minimalConfig({ signals: [minimalSignal({ startByte: start })] }))
        expect(r.errors.some((e) => e.includes('startByte must be an integer'))).toBe(true)
      }
    })

    it('rejects startByte + byteLength > 8', () => {
      const r = validateSignals(
        minimalConfig({ signals: [minimalSignal({ startByte: 6, byteLength: 4 })] })
      )
      expect(r.errors.some((e) => e.includes('startByte + byteLength must be <= 8'))).toBe(true)
    })

    it('accepts startByte + byteLength == 8 (boundary)', () => {
      const r = validateSignals(
        minimalConfig({ signals: [minimalSignal({ startByte: 4, byteLength: 4 })] })
      )
      expect(r.errors.filter((e) => e.includes('startByte') || e.includes('byteLength'))).toEqual(
        []
      )
    })
  })

  describe('endianness/signed flags', () => {
    it('rejects non-boolean bigEndian', () => {
      const r = validateSignals(minimalConfig({ signals: [minimalSignal({ bigEndian: 'big' })] }))
      expect(r.errors.some((e) => e.includes('bigEndian must be a boolean'))).toBe(true)
    })

    it('rejects non-boolean signed', () => {
      const r = validateSignals(minimalConfig({ signals: [minimalSignal({ signed: 1 })] }))
      expect(r.errors.some((e) => e.includes('signed must be a boolean'))).toBe(true)
    })
  })

  describe('bitMask', () => {
    it('accepts an absent bitMask', () => {
      const r = validateSignals(minimalConfig({ signals: [minimalSignal()] }))
      expect(r.valid).toBe(true)
    })

    it('accepts a valid hex bitMask', () => {
      const r = validateSignals(minimalConfig({ signals: [minimalSignal({ bitMask: '0x01' })] }))
      expect(r.valid).toBe(true)
    })

    it('rejects a malformed bitMask', () => {
      const r = validateSignals(minimalConfig({ signals: [minimalSignal({ bitMask: '01' })] }))
      expect(r.errors.some((e) => e.includes('bitMask must be a hex string'))).toBe(true)
    })
  })

  describe('scale and offset', () => {
    it('rejects non-finite scale', () => {
      const r = validateSignals(minimalConfig({ signals: [minimalSignal({ scale: 'x' })] }))
      expect(r.errors.some((e) => e.includes('scale must be a finite number'))).toBe(true)

      const inf = validateSignals(
        minimalConfig({ signals: [minimalSignal({ scale: Number.POSITIVE_INFINITY })] })
      )
      expect(inf.errors.some((e) => e.includes('scale must be a finite number'))).toBe(true)
    })

    it('rejects non-finite offset', () => {
      const r = validateSignals(minimalConfig({ signals: [minimalSignal({ offset: NaN })] }))
      expect(r.errors.some((e) => e.includes('offset must be a finite number'))).toBe(true)
    })
  })

  describe('range', () => {
    it('rejects non-finite min/max', () => {
      const r = validateSignals(minimalConfig({ signals: [minimalSignal({ min: 'x' })] }))
      expect(r.errors.some((e) => e.includes('min must be a finite number'))).toBe(true)
    })

    it('rejects min >= max', () => {
      const r = validateSignals(minimalConfig({ signals: [minimalSignal({ min: 100, max: 50 })] }))
      expect(r.errors.some((e) => e.includes('min must be less than max'))).toBe(true)

      const eq = validateSignals(minimalConfig({ signals: [minimalSignal({ min: 50, max: 50 })] }))
      expect(eq.errors.some((e) => e.includes('min must be less than max'))).toBe(true)
    })
  })

  describe('thresholds', () => {
    it('accepts absent warningLevel/dangerLevel', () => {
      const r = validateSignals(minimalConfig({ signals: [minimalSignal()] }))
      expect(r.valid).toBe(true)
    })

    it('rejects warningLevel out of [min, max]', () => {
      const r = validateSignals(minimalConfig({ signals: [minimalSignal({ warningLevel: 9000 })] }))
      expect(r.errors.some((e) => e.includes('warningLevel must be in [min, max]'))).toBe(true)
    })

    it('rejects dangerLevel out of [min, max]', () => {
      const r = validateSignals(minimalConfig({ signals: [minimalSignal({ dangerLevel: -1 })] }))
      expect(r.errors.some((e) => e.includes('dangerLevel must be in [min, max]'))).toBe(true)
    })

    it('accepts warningLevel > dangerLevel (low-alarm semantics — e.g. oil pressure)', () => {
      // High alarms: warning <= danger (rpm, coolant temp).
      // Low alarms: warning > danger (oil pressure, fuel level, battery voltage).
      // Both directions are valid — order is intentionally not enforced.
      const r = validateSignals(
        minimalConfig({
          signals: [
            minimalSignal({
              name: 'oil_press',
              min: 0,
              max: 10,
              warningLevel: 1.5,
              dangerLevel: 1,
            }),
          ],
        })
      )
      expect(r.valid).toBe(true)
    })

    it('accepts warningLevel == dangerLevel', () => {
      const r = validateSignals(
        minimalConfig({
          signals: [minimalSignal({ warningLevel: 6500, dangerLevel: 6500 })],
        })
      )
      expect(r.valid).toBe(true)
    })

    it('rejects non-finite warningLevel when set', () => {
      const r = validateSignals(
        minimalConfig({ signals: [minimalSignal({ warningLevel: 'high' })] })
      )
      expect(r.errors.some((e) => e.includes('warningLevel must be a finite number'))).toBe(true)
    })

    it('accepts absent highWarningLevel/highDangerLevel', () => {
      const r = validateSignals(minimalConfig({ signals: [minimalSignal()] }))
      expect(r.valid).toBe(true)
    })

    it('accepts both low-side and high-side thresholds together (battery semantics)', () => {
      const r = validateSignals(
        minimalConfig({
          signals: [
            minimalSignal({
              name: 'battery_volts',
              min: 8,
              max: 18,
              warningLevel: 12,
              dangerLevel: 11.5,
              highWarningLevel: 15,
              highDangerLevel: 16,
            }),
          ],
        })
      )
      expect(r.valid).toBe(true)
    })

    it('rejects highWarningLevel out of [min, max]', () => {
      const r = validateSignals(
        minimalConfig({ signals: [minimalSignal({ highWarningLevel: 9000 })] })
      )
      expect(r.errors.some((e) => e.includes('highWarningLevel must be in [min, max]'))).toBe(true)
    })

    it('rejects highDangerLevel out of [min, max]', () => {
      const r = validateSignals(
        minimalConfig({ signals: [minimalSignal({ highDangerLevel: -1 })] })
      )
      expect(r.errors.some((e) => e.includes('highDangerLevel must be in [min, max]'))).toBe(true)
    })

    it('rejects non-finite highWarningLevel when set', () => {
      const r = validateSignals(
        minimalConfig({ signals: [minimalSignal({ highWarningLevel: 'high' })] })
      )
      expect(r.errors.some((e) => e.includes('highWarningLevel must be a finite number'))).toBe(
        true
      )
    })

    it('rejects non-finite highDangerLevel when set', () => {
      const r = validateSignals(
        minimalConfig({ signals: [minimalSignal({ highDangerLevel: NaN })] })
      )
      expect(r.errors.some((e) => e.includes('highDangerLevel must be a finite number'))).toBe(true)
    })
  })

  describe('unit', () => {
    it('rejects non-string unit', () => {
      const r = validateSignals(minimalConfig({ signals: [minimalSignal({ unit: 5 })] }))
      expect(r.errors.some((e) => e.includes('unit must be a string'))).toBe(true)
    })

    it('rejects unit longer than 16 characters', () => {
      const longUnit = 'x'.repeat(17)
      const r = validateSignals(minimalConfig({ signals: [minimalSignal({ unit: longUnit })] }))
      expect(r.errors.some((e) => e.includes('unit must be <= 16 characters'))).toBe(true)
    })

    it('accepts unit at the 16-character boundary', () => {
      const okUnit = 'x'.repeat(16)
      const r = validateSignals(minimalConfig({ signals: [minimalSignal({ unit: okUnit })] }))
      expect(r.errors.filter((e) => e.includes('unit'))).toEqual([])
    })
  })

  describe('timeoutMs', () => {
    it('rejects non-positive integers', () => {
      for (const t of [0, -100, 1.5, 'fast']) {
        const r = validateSignals(minimalConfig({ signals: [minimalSignal({ timeoutMs: t })] }))
        expect(r.errors.some((e) => e.includes('timeoutMs must be an integer'))).toBe(true)
      }
    })

    it('rejects timeoutMs above the 60_000 cap', () => {
      const r = validateSignals(minimalConfig({ signals: [minimalSignal({ timeoutMs: 60_001 })] }))
      expect(r.errors.some((e) => e.includes('timeoutMs must be an integer'))).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// colorRamp (issue #430)
// ---------------------------------------------------------------------------

describe('validateSignals — colorRamp', () => {
  const validRamp = {
    interpolate: 'linear',
    stops: [
      { value: 0, color: '#44CC66' },
      { value: 100, color: '#CC3333' },
    ],
  }

  it('accepts a signal without colorRamp', () => {
    const result = validateSignals(minimalConfig())
    expect(result.valid).toBe(true)
  })

  it('accepts a valid colorRamp', () => {
    const result = validateSignals(
      minimalConfig({ signals: [minimalSignal({ colorRamp: validRamp })] })
    )
    expect(result.valid).toBe(true)
  })

  it('rejects fewer than 2 stops', () => {
    const result = validateSignals(
      minimalConfig({
        signals: [
          minimalSignal({
            colorRamp: { interpolate: 'linear', stops: [{ value: 0, color: '#44CC66' }] },
          }),
        ],
      })
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('colorRamp.stops must contain'))).toBe(true)
  })

  it('rejects more than MAX_RAMP_STOPS stops', () => {
    const stops = Array.from({ length: 9 }, (_, i) => ({ value: i, color: '#44CC66' }))
    const result = validateSignals(
      minimalConfig({ signals: [minimalSignal({ colorRamp: { interpolate: 'linear', stops } })] })
    )
    expect(result.valid).toBe(false)
  })

  it('rejects stops not sorted ascending', () => {
    const result = validateSignals(
      minimalConfig({
        signals: [
          minimalSignal({
            colorRamp: {
              interpolate: 'linear',
              stops: [
                { value: 100, color: '#44CC66' },
                { value: 0, color: '#CC3333' },
              ],
            },
          }),
        ],
      })
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('strictly greater'))).toBe(true)
  })

  it('rejects an invalid hex color', () => {
    const result = validateSignals(
      minimalConfig({
        signals: [
          minimalSignal({
            colorRamp: {
              interpolate: 'linear',
              stops: [
                { value: 0, color: '#GGG' },
                { value: 100, color: '#CC3333' },
              ],
            },
          }),
        ],
      })
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('6-digit hex'))).toBe(true)
  })

  it('rejects an unknown interpolate mode', () => {
    const result = validateSignals(
      minimalConfig({
        signals: [
          minimalSignal({
            colorRamp: { interpolate: 'cubic', stops: validRamp.stops },
          }),
        ],
      })
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('interpolate must be one of'))).toBe(true)
  })

  it('rejects colorRamp that is not an object (e.g. a string)', () => {
    const result = validateSignals(
      minimalConfig({
        signals: [minimalSignal({ colorRamp: 'rainbow' })],
      })
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('colorRamp must be an object when set'))).toBe(true)
  })

  it('rejects colorRamp.stops that is not an array', () => {
    const result = validateSignals(
      minimalConfig({
        signals: [
          minimalSignal({
            colorRamp: { interpolate: 'linear', stops: 'not-an-array' },
          }),
        ],
      })
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('colorRamp.stops must be an array'))).toBe(true)
  })

  it('rejects a stop entry that is not an object', () => {
    const result = validateSignals(
      minimalConfig({
        signals: [
          minimalSignal({
            colorRamp: {
              interpolate: 'linear',
              stops: [42, { value: 100, color: '#CC3333' }],
            },
          }),
        ],
      })
    )
    expect(result.valid).toBe(false)
    expect(
      result.errors.some((e) => e.includes('colorRamp.stops[0]') && e.includes('must be an object'))
    ).toBe(true)
  })

  it('rejects a stop with a non-finite value', () => {
    const result = validateSignals(
      minimalConfig({
        signals: [
          minimalSignal({
            colorRamp: {
              interpolate: 'linear',
              stops: [
                { value: 'low', color: '#44CC66' },
                { value: 100, color: '#CC3333' },
              ],
            },
          }),
        ],
      })
    )
    expect(result.valid).toBe(false)
    expect(
      result.errors.some(
        (e) => e.includes('colorRamp.stops[0].value') && e.includes('finite number')
      )
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Error accumulation
// ---------------------------------------------------------------------------

describe('validateSignals — error accumulation', () => {
  it('accumulates all errors rather than stopping at first', () => {
    const result = validateSignals({
      protocol: '',
      canSpeedKbps: 999,
      signals: [
        {
          name: '',
          canFrameId: 'bad',
          startByte: 99,
          byteLength: 7,
          bigEndian: 'big',
          signed: 0,
          scale: 'x',
          offset: 'y',
          unit: 9,
          min: 'a',
          max: 'b',
          timeoutMs: -1,
        },
      ],
    })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(5)
  })
})

import { validateSignalConfig } from '../validation/validate-signal-config.js'

const validSignal = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
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
  timeoutMs: 1000,
  ...overrides,
})

const validConfig = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  version: '1.14.0',
  protocol: 'custom_v1.0',
  canSpeedKbps: 500,
  signals: [validSignal()],
  ...overrides,
})

describe('validateSignalConfig — envelope', () => {
  it('returns valid:true for a minimal valid catalog', () => {
    const result = validateSignalConfig(validConfig())
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })

  it('returns valid:false with errors on a non-object input', () => {
    const result = validateSignalConfig(null)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('formats issues as "path: message"', () => {
    const result = validateSignalConfig(validConfig({ canSpeedKbps: 999 }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.startsWith('canSpeedKbps:'))).toBe(true)
  })
})

describe('validateSignalConfig — canFrameId', () => {
  it.each(['0x0', '0x1', '0xFF', '0x7FF', '0X123', '0xabc', '0x1234', '0x1E005000', '0xFFFFFFFF'])(
    'accepts valid hex form %s',
    (canFrameId) => {
      const result = validateSignalConfig(validConfig({ signals: [validSignal({ canFrameId })] }))
      expect(result.valid).toBe(true)
    }
  )

  it.each(['370', '#370', '0x', '0xGGG', '0x123456789', ''])(
    'rejects invalid form %s',
    (canFrameId) => {
      const result = validateSignalConfig(validConfig({ signals: [validSignal({ canFrameId })] }))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('canFrameId'))).toBe(true)
    }
  )

  it('rejects a non-string canFrameId', () => {
    const result = validateSignalConfig(
      validConfig({ signals: [validSignal({ canFrameId: 0x370 })] })
    )
    expect(result.valid).toBe(false)
  })
})

describe('validateSignalConfig — byteLength', () => {
  it.each([1, 2, 4])('accepts %i', (byteLength) => {
    const result = validateSignalConfig(validConfig({ signals: [validSignal({ byteLength })] }))
    expect(result.valid).toBe(true)
  })

  it.each([0, 3, 5, 8, -1, 1.5])('rejects %s', (byteLength) => {
    const result = validateSignalConfig(validConfig({ signals: [validSignal({ byteLength })] }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('byteLength'))).toBe(true)
  })
})

describe('validateSignalConfig — min/max range', () => {
  it('accepts min < max', () => {
    const result = validateSignalConfig(
      validConfig({ signals: [validSignal({ min: 0, max: 8000 })] })
    )
    expect(result.valid).toBe(true)
  })

  it('rejects min == max', () => {
    const result = validateSignalConfig(
      validConfig({ signals: [validSignal({ min: 100, max: 100 })] })
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.toLowerCase().includes('min must be less than max'))).toBe(
      true
    )
  })

  it('rejects min > max', () => {
    const result = validateSignalConfig(
      validConfig({ signals: [validSignal({ min: 500, max: 100 })] })
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.toLowerCase().includes('min must be less than max'))).toBe(
      true
    )
  })

  it('accepts negative ranges (e.g. coolant below zero)', () => {
    const result = validateSignalConfig(
      validConfig({ signals: [validSignal({ min: -40, max: 150 })] })
    )
    expect(result.valid).toBe(true)
  })
})

describe('validateSignalConfig — bitMask', () => {
  it('accepts a signal without bitMask', () => {
    const result = validateSignalConfig(validConfig())
    expect(result.valid).toBe(true)
  })

  it.each(['0x1', '0x01', '0xFF', '0xFF00', '0Xabcdef'])('accepts %s', (bitMask) => {
    const result = validateSignalConfig(validConfig({ signals: [validSignal({ bitMask })] }))
    expect(result.valid).toBe(true)
  })

  it.each(['1', '0xGG', '0x', 'FF', '#FF'])('rejects %s', (bitMask) => {
    const result = validateSignalConfig(validConfig({ signals: [validSignal({ bitMask })] }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('bitMask'))).toBe(true)
  })
})

describe('validateSignalConfig — canSpeedKbps', () => {
  it.each([125, 250, 500, 1000])('accepts %i', (canSpeedKbps) => {
    const result = validateSignalConfig(validConfig({ canSpeedKbps }))
    expect(result.valid).toBe(true)
  })

  it.each([0, 100, 800, 999, 2000, -500])('rejects %i', (canSpeedKbps) => {
    const result = validateSignalConfig(validConfig({ canSpeedKbps }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('canSpeedKbps'))).toBe(true)
  })

  it('rejects a non-number canSpeedKbps', () => {
    const result = validateSignalConfig(validConfig({ canSpeedKbps: '500' }))
    expect(result.valid).toBe(false)
  })
})

describe('validateSignalConfig — underscore comments (#1289)', () => {
  it('accepts the firmware signals.json top-level underscore documentation fields', () => {
    const result = validateSignalConfig(
      validConfig({
        _comment: 'CANShift CAN signal mapping — example profile.',
        _warning: 'Frame IDs and byte positions are EXAMPLES.',
        _outboundWarning: 'Outbound frame IDs in `out` are UNVERIFIED placeholders.',
      })
    )
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects a non-string _comment', () => {
    const result = validateSignalConfig(validConfig({ _comment: 42 }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('_comment'))).toBe(true)
  })

  it('accepts a per-signal _comment (firmware demo marks frame boundaries this way)', () => {
    const result = validateSignalConfig(
      validConfig({
        signals: [validSignal({ _comment: '=== FRAME 0x370 — Primary engine data ===' })],
      })
    )
    expect(result.valid).toBe(true)
  })
})

describe('validateSignalConfig — out block (#1303)', () => {
  it('accepts the firmware demo out.map_switch shape', () => {
    const result = validateSignalConfig(
      validConfig({
        out: {
          map_switch: {
            id: '0x600',
            extended: false,
            encoding: 'byte0 = mapIndex (1-based, 1..8)',
          },
        },
      })
    )
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('accepts an out entry with id only (extended defaults at the firmware boundary)', () => {
    const result = validateSignalConfig(validConfig({ out: { map_switch: { id: '0x600' } } }))
    expect(result.valid).toBe(true)
  })

  it('accepts the empty out block', () => {
    const result = validateSignalConfig(validConfig({ out: {} }))
    expect(result.valid).toBe(true)
  })

  it('accepts extended-range hex ids up to 0x1FFFFFFF', () => {
    const result = validateSignalConfig(
      validConfig({ out: { map_switch: { id: '0x1FFFFFFF', extended: true } } })
    )
    expect(result.valid).toBe(true)
  })

  it.each(['600', '#600', '0x', '0xGGG', '0xZZZZ', ''])('rejects non-hex id %s', (id) => {
    const result = validateSignalConfig(validConfig({ out: { map_switch: { id } } }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('out.map_switch.id'))).toBe(true)
  })

  it('rejects an id past the 29-bit boundary', () => {
    const result = validateSignalConfig(validConfig({ out: { map_switch: { id: '0x20000000' } } }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('out.map_switch.id'))).toBe(true)
  })

  it('rejects a non-string id', () => {
    const result = validateSignalConfig(validConfig({ out: { map_switch: { id: 0x600 } } }))
    expect(result.valid).toBe(false)
  })

  it('rejects a non-boolean extended', () => {
    const result = validateSignalConfig(
      validConfig({ out: { map_switch: { id: '0x600', extended: 'yes' } } })
    )
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('out.map_switch.extended'))).toBe(true)
  })

  it('rejects unknown fields on an out entry (strict)', () => {
    const result = validateSignalConfig(
      validConfig({
        out: { map_switch: { id: '0x600', mystery: 'nope' } },
      })
    )
    expect(result.valid).toBe(false)
  })
})

describe('validateSignalConfig — _batteryThresholds (#1303)', () => {
  it('accepts a descriptive _batteryThresholds string (matches firmware demo)', () => {
    const result = validateSignalConfig(
      validConfig({
        signals: [
          validSignal({
            name: 'battery_volts',
            _batteryThresholds:
              'Battery uses BOTH low-side and high-side thresholds. Tune per chemistry.',
          }),
        ],
      })
    )
    expect(result.valid).toBe(true)
  })

  it.each([42, -1, true, null, { low: 12 }, [12, 11]])(
    'rejects non-string _batteryThresholds (%s)',
    (value) => {
      const result = validateSignalConfig(
        validConfig({ signals: [validSignal({ _batteryThresholds: value })] })
      )
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('_batteryThresholds'))).toBe(true)
    }
  )
})

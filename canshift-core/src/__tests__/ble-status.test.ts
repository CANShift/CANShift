import { BleStatusWireSchema, bleStatusFromWire, parseBleStatus } from '../schemas/ble-status.js'
import type { BleStatusWire } from '../schemas/ble-status.js'

describe('BleStatusWireSchema', () => {
  it('accepts an empty object (firmware before any STATUS field landed)', () => {
    expect(BleStatusWireSchema.parse({})).toEqual({})
  })

  it('accepts every field present', () => {
    const wire = {
      ver: '0.8.3',
      can: 1,
      is_day: 0,
    }
    expect(BleStatusWireSchema.parse(wire)).toEqual(wire)
  })

  it('rejects extra wire fields (strict)', () => {
    expect(() => BleStatusWireSchema.parse({ ver: '1.0.0', unexpected: 'x' })).toThrow()
  })

  it('rejects strings longer than the cap', () => {
    expect(() => BleStatusWireSchema.parse({ ver: 'x'.repeat(33) })).toThrow()
  })

  it('rejects non-finite numbers', () => {
    expect(() => BleStatusWireSchema.parse({ can: Number.NaN })).toThrow()
    expect(() => BleStatusWireSchema.parse({ is_day: Number.POSITIVE_INFINITY })).toThrow()
  })

  it('rejects can/is_day values other than 0 or 1', () => {
    expect(BleStatusWireSchema.safeParse({ can: 0 }).success).toBe(true)
    expect(BleStatusWireSchema.safeParse({ can: 1 }).success).toBe(true)
    expect(BleStatusWireSchema.safeParse({ is_day: 0 }).success).toBe(true)
    expect(BleStatusWireSchema.safeParse({ is_day: 1 }).success).toBe(true)

    expect(BleStatusWireSchema.safeParse({ can: 0.5 }).success).toBe(false)
    expect(BleStatusWireSchema.safeParse({ can: 2 }).success).toBe(false)
    expect(BleStatusWireSchema.safeParse({ can: -1 }).success).toBe(false)
    expect(BleStatusWireSchema.safeParse({ is_day: 0.5 }).success).toBe(false)
    expect(BleStatusWireSchema.safeParse({ is_day: 2 }).success).toBe(false)
  })
})

describe('bleStatusFromWire', () => {
  it('renames snake_case keys to camelCase and translates numeric flags to booleans', () => {
    const wire: BleStatusWire = {
      ver: '0.8.3',
      can: 1,
      is_day: 0,
    }
    expect(bleStatusFromWire(wire)).toEqual({
      firmwareVersion: '0.8.3',
      canHealthy: true,
      isDay: false,
    })
  })

  it('translates can=0 / is_day=0 to false and 1 to true', () => {
    expect(bleStatusFromWire({ can: 0 })).toEqual({ canHealthy: false })
    expect(bleStatusFromWire({ can: 1 })).toEqual({ canHealthy: true })
    expect(bleStatusFromWire({ is_day: 0 })).toEqual({ isDay: false })
    expect(bleStatusFromWire({ is_day: 1 })).toEqual({ isDay: true })
  })

  it('omits absent fields from the domain object (no undefined leakage)', () => {
    expect(bleStatusFromWire({ ver: '0.1.0' })).toEqual({ firmwareVersion: '0.1.0' })
    expect(Object.keys(bleStatusFromWire({ ver: '0.1.0' }))).toEqual(['firmwareVersion'])
  })
})

describe('parseBleStatus', () => {
  it('returns kind="ok" with the domain shape for a valid payload', () => {
    const raw = '{"ver":"1.0","can":1,"is_day":1}'
    const result = parseBleStatus(raw)
    expect(result).toEqual({
      kind: 'ok',
      status: {
        firmwareVersion: '1.0',
        canHealthy: true,
        isDay: true,
      },
    })
  })

  it('returns kind="invalid_json" on JSON parse failure and preserves raw input', () => {
    const result = parseBleStatus('not json')
    expect(result.kind).toBe('invalid_json')
    if (result.kind === 'invalid_json') {
      expect(result.raw).toBe('not json')
    }
    expect(parseBleStatus('').kind).toBe('invalid_json')
    expect(parseBleStatus('{').kind).toBe('invalid_json')
  })

  it('returns kind="not_an_object" when the JSON is a primitive or array', () => {
    const arr = parseBleStatus('[1,2,3]')
    expect(arr.kind).toBe('not_an_object')
    if (arr.kind === 'not_an_object') {
      expect(arr.payload).toEqual([1, 2, 3])
    }

    const str = parseBleStatus('"hello"')
    expect(str.kind).toBe('not_an_object')
    if (str.kind === 'not_an_object') {
      expect(str.payload).toBe('hello')
    }

    const num = parseBleStatus('42')
    expect(num.kind).toBe('not_an_object')
    if (num.kind === 'not_an_object') {
      expect(num.payload).toBe(42)
    }

    const nul = parseBleStatus('null')
    expect(nul.kind).toBe('not_an_object')
    if (nul.kind === 'not_an_object') {
      expect(nul.payload).toBeNull()
    }
  })

  it('returns kind="wrong_shape" with Zod issues when the object fails strict schema', () => {
    const extra = parseBleStatus('{"ver":"1.0","junk":1}')
    expect(extra.kind).toBe('wrong_shape')
    if (extra.kind === 'wrong_shape') {
      expect(extra.issues.length).toBeGreaterThan(0)
      expect(extra.issues[0]).toHaveProperty('code')
      expect(extra.issues[0]).toHaveProperty('path')
    }

    const badType = parseBleStatus('{"can":"not a number"}')
    expect(badType.kind).toBe('wrong_shape')
    if (badType.kind === 'wrong_shape') {
      expect(badType.issues.length).toBeGreaterThan(0)
    }
  })

  it('discriminates the three failure cases the old null-return collapsed', () => {
    const malformed = parseBleStatus('{not-json')
    const wrongType = parseBleStatus('123')
    const wrongShape = parseBleStatus('{"unknown":"x"}')
    expect(malformed.kind).toBe('invalid_json')
    expect(wrongType.kind).toBe('not_an_object')
    expect(wrongShape.kind).toBe('wrong_shape')
  })
})

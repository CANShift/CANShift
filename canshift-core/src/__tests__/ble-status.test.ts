// ble-status.test.ts — Schema + wire mapper coverage for #887.

import {
  BleStatusWireSchema,
  bleStatusFromWire,
  parseBleStatus,
} from '../schemas/ble-status.js'

describe('BleStatusWireSchema', () => {
  it('accepts an empty object (firmware before any STATUS field landed)', () => {
    expect(BleStatusWireSchema.parse({})).toEqual({})
  })

  it('accepts every field present', () => {
    const wire = {
      ver: '0.8.3',
      can: 1,
      ap_ssid: 'CANShift-AP',
      ap_password: 'abcDEF12',
      is_day: 0,
    }
    expect(BleStatusWireSchema.parse(wire)).toEqual(wire)
  })

  it('rejects extra wire fields (strict)', () => {
    expect(() =>
      BleStatusWireSchema.parse({ ver: '1.0.0', unexpected: 'x' })
    ).toThrow()
  })

  it('rejects strings longer than the cap', () => {
    expect(() => BleStatusWireSchema.parse({ ver: 'x'.repeat(33) })).toThrow()
  })

  it('rejects non-finite numbers', () => {
    expect(() => BleStatusWireSchema.parse({ can: Number.NaN })).toThrow()
    expect(() => BleStatusWireSchema.parse({ is_day: Number.POSITIVE_INFINITY })).toThrow()
  })
})

describe('bleStatusFromWire', () => {
  it('renames snake_case keys to camelCase and translates numeric flags to booleans', () => {
    const wire = {
      ver: '0.8.3',
      can: 1,
      ap_ssid: 'CANShift-AP',
      ap_password: 'abcDEF12',
      is_day: 0,
    }
    expect(bleStatusFromWire(wire)).toEqual({
      firmwareVersion: '0.8.3',
      canHealthy: true,
      apSsid: 'CANShift-AP',
      apPassword: 'abcDEF12',
      isDay: false,
    })
  })

  it('treats can=0 / is_day=0 as false and any non-zero as true', () => {
    expect(bleStatusFromWire({ can: 0 })).toEqual({ canHealthy: false })
    expect(bleStatusFromWire({ can: 1 })).toEqual({ canHealthy: true })
    expect(bleStatusFromWire({ can: 2 })).toEqual({ canHealthy: true })
    expect(bleStatusFromWire({ is_day: 0 })).toEqual({ isDay: false })
    expect(bleStatusFromWire({ is_day: 1 })).toEqual({ isDay: true })
  })

  it('omits absent fields from the domain object (no undefined leakage)', () => {
    expect(bleStatusFromWire({ ver: '0.1.0' })).toEqual({ firmwareVersion: '0.1.0' })
    expect(Object.keys(bleStatusFromWire({ ver: '0.1.0' }))).toEqual(['firmwareVersion'])
  })
})

describe('parseBleStatus', () => {
  it('parses a valid JSON payload end-to-end', () => {
    const raw = '{"ver":"1.0","can":1,"ap_ssid":"X","ap_password":"y","is_day":1}'
    expect(parseBleStatus(raw)).toEqual({
      firmwareVersion: '1.0',
      canHealthy: true,
      apSsid: 'X',
      apPassword: 'y',
      isDay: true,
    })
  })

  it('returns null on JSON parse failure', () => {
    expect(parseBleStatus('not json')).toBeNull()
    expect(parseBleStatus('')).toBeNull()
  })

  it('returns null when the payload is not a JSON object', () => {
    expect(parseBleStatus('[1,2,3]')).toBeNull()
    expect(parseBleStatus('"hello"')).toBeNull()
    expect(parseBleStatus('42')).toBeNull()
  })

  it('returns null when the payload fails the strict schema', () => {
    expect(parseBleStatus('{"ver":"1.0","junk":1}')).toBeNull()
    expect(parseBleStatus('{"can":"not a number"}')).toBeNull()
  })
})

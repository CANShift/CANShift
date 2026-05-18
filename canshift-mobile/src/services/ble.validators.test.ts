// ble.validators.test.ts — Pure-logic tests for BLE payload validators.
// STATUS coverage lives in canshift-core/__tests__/ble-status.test.ts (#887).

import { parseTelemetry } from './ble.validators'

describe('parseTelemetry', () => {
  it('returns sanitized record with only allowlisted finite numbers', () => {
    const raw = JSON.stringify({ r: 4500, tps: 25, map: 100, bst: 0.8 })
    const result = parseTelemetry(raw)
    expect(result).toEqual({ r: 4500, tps: 25, map: 100, bst: 0.8 })
  })

  it('drops unknown keys, NaN, Infinity, and non-number values', () => {
    const raw = JSON.stringify({
      r: 3000,
      unknownKey: 999,
      tps: 'high',
      map: NaN,
      bst: Infinity,
      iat: -Infinity,
      ct: 90,
    })
    const result = parseTelemetry(raw)
    expect(result).toEqual({ r: 3000, ct: 90 })
  })

  it('returns null for non-object input (parse failure, array, primitive)', () => {
    expect(parseTelemetry('not-json')).toBeNull()
    expect(parseTelemetry('[1,2,3]')).toBeNull()
    expect(parseTelemetry('42')).toBeNull()
    expect(parseTelemetry('null')).toBeNull()
  })

  it('returns empty object when all keys are invalid but JSON is an object', () => {
    const raw = JSON.stringify({ foo: 1, bar: 'baz' })
    const result = parseTelemetry(raw)
    expect(result).toEqual({})
  })
})

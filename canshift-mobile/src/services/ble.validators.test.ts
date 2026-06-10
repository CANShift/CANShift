import { _resetSessionState, parseTelemetry } from './ble.validators'
import { useLogStore } from '../stores/log.store'

describe('parseTelemetry — sanitisation', () => {
  beforeEach(() => {
    _resetSessionState()
    useLogStore.getState().clear()
  })

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

describe('parseTelemetry — unknown-key warning is debounced per session (#1017 M-LO-1)', () => {
  beforeEach(() => {
    _resetSessionState()
    useLogStore.getState().clear()
  })

  it('emits exactly one warn the first time an unknown key is seen', () => {
    parseTelemetry(JSON.stringify({ r: 3000, mysterySignal: 42 }))
    const entries = useLogStore.getState().entries
    expect(entries).toHaveLength(1)
    expect(entries[0]?.level).toBe('warn')
    expect(entries[0]?.message).toContain('mysterySignal')
  })

  it('does NOT re-warn on subsequent payloads carrying the same unknown key', () => {
    parseTelemetry(JSON.stringify({ mysterySignal: 1 }))
    parseTelemetry(JSON.stringify({ mysterySignal: 2 }))
    parseTelemetry(JSON.stringify({ mysterySignal: 3 }))
    expect(useLogStore.getState().entries).toHaveLength(1)
  })

  it('warns once per distinct unknown key, across many payloads', () => {
    parseTelemetry(JSON.stringify({ mysteryA: 1 }))
    parseTelemetry(JSON.stringify({ mysteryB: 2 }))
    parseTelemetry(JSON.stringify({ mysteryA: 3 }))
    parseTelemetry(JSON.stringify({ mysteryC: 4 }))
    parseTelemetry(JSON.stringify({ mysteryB: 5 }))

    const entries = useLogStore.getState().entries
    expect(entries).toHaveLength(3)
    const messages = entries.map((e) => e.message).join('\n')
    expect(messages).toContain('mysteryA')
    expect(messages).toContain('mysteryB')
    expect(messages).toContain('mysteryC')
  })

  it('does not warn on allowlisted keys', () => {
    parseTelemetry(JSON.stringify({ r: 3000, tps: 25, map: 100 }))
    expect(useLogStore.getState().entries).toHaveLength(0)
  })

  it('warning message names the offending key and announces the once-per-session policy', () => {
    parseTelemetry(JSON.stringify({ mystery: 1 }))
    const entries = useLogStore.getState().entries
    expect(entries[0]?.message).toMatch(/unknown signal "mystery"/)
    expect(entries[0]?.message).toMatch(/will not warn again/i)
  })

  it('still drops the unknown key from the sanitized output', () => {
    const result = parseTelemetry(JSON.stringify({ r: 3000, mystery: 1 }))
    expect(result).toEqual({ r: 3000 })
  })

  it('_resetSessionState clears the warning memo so a follow-up payload warns again', () => {
    parseTelemetry(JSON.stringify({ mystery: 1 }))
    expect(useLogStore.getState().entries).toHaveLength(1)

    _resetSessionState()
    useLogStore.getState().clear()

    parseTelemetry(JSON.stringify({ mystery: 2 }))
    expect(useLogStore.getState().entries).toHaveLength(1)
  })
})

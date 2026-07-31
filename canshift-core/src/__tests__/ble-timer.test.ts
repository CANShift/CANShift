import {
  TIMER_COMMAND_CODES,
  TIMER_LAP_BUFFER_CAPACITY,
  TimerLapWireSchema,
  TimerStateWireSchema,
  encodeTimerCommand,
  parseTimerLap,
  parseTimerState,
  timerLapFromWire,
  timerStateFromWire,
} from '../schemas/ble-timer.js'
import type { TimerCommand } from '../schemas/ble-timer.js'

describe('encodeTimerCommand', () => {
  it('encodes every command as {"op":<code>}', () => {
    const commands = Object.keys(TIMER_COMMAND_CODES) as TimerCommand[]
    for (const command of commands) {
      expect(JSON.parse(encodeTimerCommand(command))).toEqual({
        op: TIMER_COMMAND_CODES[command],
      })
    }
  })

  it('assigns distinct codes to all commands', () => {
    const codes = Object.values(TIMER_COMMAND_CODES)
    expect(new Set(codes).size).toBe(codes.length)
  })
})

describe('TimerStateWireSchema', () => {
  const valid = { st: 1, el: 12345, lc: 3, sid: 2, ver: 7 }

  it('accepts a complete state payload', () => {
    expect(TimerStateWireSchema.parse(valid)).toMatchObject(valid)
  })

  it('tolerates unknown wire fields (passthrough)', () => {
    const parsed = TimerStateWireSchema.parse({ ...valid, extra: 'x' })
    expect(parsed.st).toBe(1)
  })

  it('rejects a missing field', () => {
    const missing: Record<string, unknown> = { ...valid }
    delete missing.ver
    expect(TimerStateWireSchema.safeParse(missing).success).toBe(false)
  })

  it('rejects out-of-range run states', () => {
    expect(TimerStateWireSchema.safeParse({ ...valid, st: 3 }).success).toBe(false)
    expect(TimerStateWireSchema.safeParse({ ...valid, st: -1 }).success).toBe(false)
  })

  it('rejects negative and non-integer elapsed values', () => {
    expect(TimerStateWireSchema.safeParse({ ...valid, el: -1 }).success).toBe(false)
    expect(TimerStateWireSchema.safeParse({ ...valid, el: 1.5 }).success).toBe(false)
  })
})

describe('timerStateFromWire', () => {
  it('maps wire codes to camelCase domain state', () => {
    expect(timerStateFromWire({ st: 0, el: 0, lc: 0, sid: 0, ver: 0 })).toEqual({
      state: 'reset',
      elapsedMs: 0,
      lapCount: 0,
      sessionId: 0,
      version: 0,
    })
    expect(timerStateFromWire({ st: 1, el: 5, lc: 1, sid: 2, ver: 9 }).state).toBe('running')
    expect(timerStateFromWire({ st: 2, el: 5, lc: 1, sid: 2, ver: 9 }).state).toBe('paused')
  })
})

describe('TimerLapWireSchema', () => {
  const valid = { sid: 2, idx: 3, lap_ms: 61234, total_ms: 185000 }

  it('accepts a complete lap payload', () => {
    expect(TimerLapWireSchema.parse(valid)).toMatchObject(valid)
  })

  it('rejects a zero lap index', () => {
    expect(TimerLapWireSchema.safeParse({ ...valid, idx: 0 }).success).toBe(false)
  })

  it('rejects negative durations', () => {
    expect(TimerLapWireSchema.safeParse({ ...valid, lap_ms: -1 }).success).toBe(false)
    expect(TimerLapWireSchema.safeParse({ ...valid, total_ms: -1 }).success).toBe(false)
  })
})

describe('timerLapFromWire', () => {
  it('maps snake_case wire keys to camelCase', () => {
    expect(timerLapFromWire({ sid: 2, idx: 3, lap_ms: 61234, total_ms: 185000 })).toEqual({
      sessionId: 2,
      index: 3,
      lapMs: 61234,
      totalMs: 185000,
    })
  })
})

describe('parseTimerState', () => {
  it('round-trips a firmware payload', () => {
    const result = parseTimerState('{"st":1,"el":42000,"lc":2,"sid":1,"ver":11}')
    expect(result).toEqual({
      kind: 'ok',
      state: { state: 'running', elapsedMs: 42000, lapCount: 2, sessionId: 1, version: 11 },
    })
  })

  it('flags invalid JSON', () => {
    expect(parseTimerState('not json').kind).toBe('invalid_json')
  })

  it('flags non-object payloads', () => {
    expect(parseTimerState('[1,2]').kind).toBe('not_an_object')
    expect(parseTimerState('null').kind).toBe('not_an_object')
  })

  it('flags wrong shapes with issues', () => {
    const result = parseTimerState('{"st":9}')
    expect(result.kind).toBe('wrong_shape')
    if (result.kind === 'wrong_shape') {
      expect(result.issues.length).toBeGreaterThan(0)
    }
  })
})

describe('parseTimerLap', () => {
  it('round-trips a firmware payload', () => {
    const result = parseTimerLap('{"sid":0,"idx":1,"lap_ms":900,"total_ms":900}')
    expect(result).toEqual({
      kind: 'ok',
      lap: { sessionId: 0, index: 1, lapMs: 900, totalMs: 900 },
    })
  })

  it('flags invalid JSON', () => {
    expect(parseTimerLap('{').kind).toBe('invalid_json')
  })

  it('flags wrong shapes', () => {
    expect(parseTimerLap('{"idx":1}').kind).toBe('wrong_shape')
  })
})

describe('TIMER_LAP_BUFFER_CAPACITY', () => {
  it('matches the firmware ring size', () => {
    expect(TIMER_LAP_BUFFER_CAPACITY).toBe(32)
  })
})

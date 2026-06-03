// ws-frames.test.ts — Schema coverage for the inbound studio-web frames (#1288).

import { CanFrameSchema, LogFrameSchema, TeleFrameSchema } from '../schemas/ws-frames.js'

describe('LogFrameSchema', () => {
  it('accepts a well-formed log frame', () => {
    const frame = { log: 1, lvl: 'I', tag: 'CAN', msg: 'hello' }
    expect(LogFrameSchema.parse(frame)).toEqual(frame)
  })

  it('accepts every known level', () => {
    for (const lvl of ['E', 'W', 'I', 'D', 'V']) {
      expect(LogFrameSchema.parse({ log: 1, lvl, tag: 't', msg: 'm' })).toBeDefined()
    }
  })

  it('rejects an unknown level', () => {
    expect(() => LogFrameSchema.parse({ log: 1, lvl: 'X', tag: 't', msg: 'm' })).toThrow()
  })

  it('rejects a non-string tag/msg', () => {
    expect(() => LogFrameSchema.parse({ log: 1, lvl: 'I', tag: 42, msg: 'm' })).toThrow()
    expect(() => LogFrameSchema.parse({ log: 1, lvl: 'I', tag: 't', msg: 42 })).toThrow()
  })

  it('passes through additive firmware fields', () => {
    const out = LogFrameSchema.parse({ log: 1, lvl: 'I', tag: 't', msg: 'm', seq: 99 })
    expect(out).toMatchObject({ seq: 99 })
  })
})

describe('CanFrameSchema', () => {
  it('accepts a well-formed CAN frame', () => {
    const frame = { can: 1, id: 0x123, len: 8, d: [0, 1, 2, 3, 4, 5, 6, 7] }
    expect(CanFrameSchema.parse(frame)).toEqual(frame)
  })

  it('rejects a len > 8 or a payload longer than 8 bytes', () => {
    expect(() => CanFrameSchema.parse({ can: 1, id: 1, len: 9, d: [] })).toThrow()
    expect(() =>
      CanFrameSchema.parse({ can: 1, id: 1, len: 8, d: [0, 0, 0, 0, 0, 0, 0, 0, 0] })
    ).toThrow()
  })

  it('rejects bytes outside 0..255', () => {
    expect(() => CanFrameSchema.parse({ can: 1, id: 1, len: 1, d: [256] })).toThrow()
    expect(() => CanFrameSchema.parse({ can: 1, id: 1, len: 1, d: [-1] })).toThrow()
  })

  it('rejects a negative or non-integer id', () => {
    expect(() => CanFrameSchema.parse({ can: 1, id: -1, len: 0, d: [] })).toThrow()
    expect(() => CanFrameSchema.parse({ can: 1, id: 1.5, len: 0, d: [] })).toThrow()
  })
})

describe('TeleFrameSchema', () => {
  it('accepts a well-formed tele frame with finite signal values', () => {
    const frame = { tele: 1, v: { rpm: 1234, coolant: 89.5 } }
    expect(TeleFrameSchema.parse(frame)).toEqual(frame)
  })

  it('accepts an empty signal map', () => {
    expect(TeleFrameSchema.parse({ tele: 1, v: {} })).toEqual({ tele: 1, v: {} })
  })

  it('rejects non-finite values', () => {
    expect(() => TeleFrameSchema.parse({ tele: 1, v: { rpm: Number.NaN } })).toThrow()
    expect(() =>
      TeleFrameSchema.parse({ tele: 1, v: { rpm: Number.POSITIVE_INFINITY } })
    ).toThrow()
  })

  it('rejects non-numeric values', () => {
    expect(() => TeleFrameSchema.parse({ tele: 1, v: { rpm: 'fast' } })).toThrow()
  })
})

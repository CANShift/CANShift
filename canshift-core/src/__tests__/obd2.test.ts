import {
  OBD2_DEFAULT_INTERVAL_MS,
  OBD2_MAX_INTERVAL_MS,
  OBD2_MIN_INTERVAL_MS,
  Obd2PollingSchema,
} from '../index.js'
import { SignalDefSchema } from '../schemas/signal.js'

const broadcastSignal = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  name: 'rpm',
  canFrameId: '0x7E8',
  startByte: 3,
  byteLength: 2,
  bigEndian: true,
  signed: false,
  scale: 0.25,
  offset: 0,
  unit: 'rpm',
  min: 0,
  max: 8000,
  timeoutMs: 2000,
  ...overrides,
})

describe('Obd2PollingSchema', () => {
  it('accepts a valid block (Mode 01, RPM PID, 1s interval)', () => {
    const result = Obd2PollingSchema.safeParse({ mode: 0x01, pid: 0x0c, intervalMs: 1000 })
    expect(result.success).toBe(true)
  })

  it('rejects a mode other than 0x01 (v1 scope is Mode 01 only)', () => {
    const result = Obd2PollingSchema.safeParse({ mode: 0x02, pid: 0x0c, intervalMs: 1000 })
    expect(result.success).toBe(false)
  })

  it('rejects an interval below the minimum (bus DoS guard)', () => {
    const result = Obd2PollingSchema.safeParse({
      mode: 0x01,
      pid: 0x0c,
      intervalMs: OBD2_MIN_INTERVAL_MS - 1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects an interval above the maximum', () => {
    const result = Obd2PollingSchema.safeParse({
      mode: 0x01,
      pid: 0x0c,
      intervalMs: OBD2_MAX_INTERVAL_MS + 1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a PID outside the byte range', () => {
    expect(Obd2PollingSchema.safeParse({ mode: 0x01, pid: -1, intervalMs: 1000 }).success).toBe(
      false
    )
    expect(Obd2PollingSchema.safeParse({ mode: 0x01, pid: 0x100, intervalMs: 1000 }).success).toBe(
      false
    )
  })

  it('rejects an unknown extra field (strict)', () => {
    const result = Obd2PollingSchema.safeParse({
      mode: 0x01,
      pid: 0x0c,
      intervalMs: 1000,
      extra: 'nope',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-integer interval', () => {
    const result = Obd2PollingSchema.safeParse({ mode: 0x01, pid: 0x0c, intervalMs: 100.5 })
    expect(result.success).toBe(false)
  })

  it('exposes a default interval inside the allowed range', () => {
    expect(OBD2_DEFAULT_INTERVAL_MS).toBeGreaterThanOrEqual(OBD2_MIN_INTERVAL_MS)
    expect(OBD2_DEFAULT_INTERVAL_MS).toBeLessThanOrEqual(OBD2_MAX_INTERVAL_MS)
  })
})

describe('SignalDefSchema with polling', () => {
  it('accepts a signal without polling (legacy broadcast behaviour)', () => {
    const result = SignalDefSchema.safeParse(broadcastSignal())
    expect(result.success).toBe(true)
  })

  it('accepts a signal with a valid polling block', () => {
    const result = SignalDefSchema.safeParse(
      broadcastSignal({ polling: { mode: 0x01, pid: 0x0c, intervalMs: 1000 } })
    )
    expect(result.success).toBe(true)
  })

  it('rejects a signal with an invalid polling block (bad mode)', () => {
    const result = SignalDefSchema.safeParse(
      broadcastSignal({ polling: { mode: 0x02, pid: 0x0c, intervalMs: 1000 } })
    )
    expect(result.success).toBe(false)
  })

  it('rejects a signal with an invalid polling block (interval too short)', () => {
    const result = SignalDefSchema.safeParse(
      broadcastSignal({
        polling: { mode: 0x01, pid: 0x0c, intervalMs: OBD2_MIN_INTERVAL_MS - 1 },
      })
    )
    expect(result.success).toBe(false)
  })
})

import {
  OBD2_DEFAULT_INTERVAL_MS,
  OBD2_MODE01_PIDS,
  OBD2_REQUEST_FRAME_ID,
  OBD2_RESPONSE_FRAME_ID,
  Obd2PollingSchema,
  obd2PidLookup,
} from '../index.js'

describe('OBD2_MODE01_PIDS catalog', () => {
  it('exposes the J1979 request/response frame IDs', () => {
    expect(OBD2_REQUEST_FRAME_ID).toBe(0x7df)
    expect(OBD2_RESPONSE_FRAME_ID).toBe(0x7e8)
  })

  it('is non-empty and ordered by PID hex', () => {
    expect(OBD2_MODE01_PIDS.length).toBeGreaterThan(0)
    for (let i = 1; i < OBD2_MODE01_PIDS.length; i++) {
      const current = OBD2_MODE01_PIDS[i]
      const previous = OBD2_MODE01_PIDS[i - 1]
      expect(current).toBeDefined()
      expect(previous).toBeDefined()
      if (current && previous) {
        expect(current.pid).toBeGreaterThan(previous.pid)
      }
    }
  })

  it('uses unique PID + signal-name keys', () => {
    const pids = OBD2_MODE01_PIDS.map((entry) => entry.pid)
    const signals = OBD2_MODE01_PIDS.map((entry) => entry.signal)
    expect(new Set(pids).size).toBe(pids.length)
    expect(new Set(signals).size).toBe(signals.length)
  })

  it('keeps every PID inside the byte range', () => {
    for (const entry of OBD2_MODE01_PIDS) {
      expect(entry.pid).toBeGreaterThanOrEqual(0)
      expect(entry.pid).toBeLessThanOrEqual(0xff)
    }
  })

  it('uses J1979-compatible decode hints (byte 3+ for the payload)', () => {
    for (const entry of OBD2_MODE01_PIDS) {
      expect(entry.decode.startByte).toBeGreaterThanOrEqual(3)
      expect([1, 2, 4]).toContain(entry.decode.byteLength)
    }
  })

  it('keeps decode ranges coherent (min < max)', () => {
    for (const entry of OBD2_MODE01_PIDS) {
      expect(entry.range.min).toBeLessThan(entry.range.max)
    }
  })

  it('resolves a known PID via obd2PidLookup', () => {
    const entry = obd2PidLookup(0x0c)
    expect(entry).toBeDefined()
    expect(entry?.signal).toBe('rpm')
  })

  it('returns undefined for an unknown PID', () => {
    expect(obd2PidLookup(0xff)).toBeUndefined()
  })

  it('builds catalog entries the OBD-II polling block accepts', () => {
    for (const entry of OBD2_MODE01_PIDS) {
      const result = Obd2PollingSchema.safeParse({
        mode: 0x01,
        pid: entry.pid,
        intervalMs: OBD2_DEFAULT_INTERVAL_MS,
      })
      expect(result.success).toBe(true)
    }
  })
})

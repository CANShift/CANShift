import { LAP_TIME_PLACEHOLDER, formatLapMs } from './lap-time'

describe('formatLapMs', () => {
  it('formats zero', () => {
    expect(formatLapMs(0)).toBe('0:00.000')
  })

  it('formats sub-minute times', () => {
    expect(formatLapMs(45_678)).toBe('0:45.678')
  })

  it('formats minute-range lap times', () => {
    expect(formatLapMs(83_456)).toBe('1:23.456')
  })

  it('formats laps beyond ten minutes', () => {
    expect(formatLapMs(600_000)).toBe('10:00.000')
  })

  it('clamps negative input to zero', () => {
    expect(formatLapMs(-500)).toBe('0:00.000')
  })

  it('floors fractional milliseconds', () => {
    expect(formatLapMs(999.9)).toBe('0:00.999')
  })

  it('exposes a stable placeholder for absent times', () => {
    expect(LAP_TIME_PLACEHOLDER).toBe('--:--.---')
  })
})

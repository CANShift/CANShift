import { SignalDefSchema } from '../schemas/signal.js'

const BASE = {
  name: 'sig',
  canFrameId: '0x123',
  startByte: 0,
  byteLength: 2 as const,
  bigEndian: true,
  signed: false,
  scale: 1,
  offset: 0,
  unit: 'u',
  min: 0,
  max: 100,
  timeoutMs: 500,
}

describe('SignalDefSchema — ramp-direction invariants (#1010)', () => {
  it('accepts a valid high-side pair (warning <= danger)', () => {
    const result = SignalDefSchema.safeParse({
      ...BASE,
      warningLevel: 70,
      dangerLevel: 90,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a valid low-side pair (danger <= warning)', () => {
    const result = SignalDefSchema.safeParse({
      ...BASE,
      warningLevel: 30,
      dangerLevel: 10,
    })
    expect(result.success).toBe(true)
  })

  it('rejects equal warning and danger (no ramp)', () => {
    const result = SignalDefSchema.safeParse({
      ...BASE,
      warningLevel: 50,
      dangerLevel: 50,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('dangerLevel'))).toBe(true)
    }
  })

  it('accepts a signal with no thresholds at all', () => {
    expect(SignalDefSchema.safeParse(BASE).success).toBe(true)
  })

  it('accepts a signal with only one of the primary pair set', () => {
    expect(SignalDefSchema.safeParse({ ...BASE, warningLevel: 70 }).success).toBe(true)
    expect(SignalDefSchema.safeParse({ ...BASE, dangerLevel: 90 }).success).toBe(true)
  })

  it('rejects warningLevel above max', () => {
    const result = SignalDefSchema.safeParse({ ...BASE, warningLevel: 150 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('warningLevel'))).toBe(true)
    }
  })

  it('rejects dangerLevel below min', () => {
    const result = SignalDefSchema.safeParse({ ...BASE, dangerLevel: -5 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('dangerLevel'))).toBe(true)
    }
  })

  it('rejects highWarningLevel outside [min, max]', () => {
    const result = SignalDefSchema.safeParse({ ...BASE, highWarningLevel: 200 })
    expect(result.success).toBe(false)
  })

  it('rejects highDangerLevel outside [min, max]', () => {
    const result = SignalDefSchema.safeParse({ ...BASE, highDangerLevel: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects a high-side dual pair with highWarning > highDanger', () => {
    const result = SignalDefSchema.safeParse({
      ...BASE,
      highWarningLevel: 90,
      highDangerLevel: 70,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('highDangerLevel'))).toBe(true)
    }
  })

  it('accepts a valid two-sided signal (battery: low-side under + high-side over)', () => {
    const result = SignalDefSchema.safeParse({
      ...BASE,
      min: 8,
      max: 18,
      warningLevel: 12.0,
      dangerLevel: 11.5,
      highWarningLevel: 15.0,
      highDangerLevel: 16.0,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a two-sided signal where the low-side warn overlaps the high-side warn', () => {
    const result = SignalDefSchema.safeParse({
      ...BASE,
      min: 0,
      max: 20,
      warningLevel: 16.0,
      dangerLevel: 15.5,
      highWarningLevel: 15.0,
      highDangerLevel: 18.0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a two-sided signal where warningLevel equals highWarningLevel', () => {
    const result = SignalDefSchema.safeParse({
      ...BASE,
      min: 0,
      max: 20,
      warningLevel: 12.0,
      dangerLevel: 11.0,
      highWarningLevel: 12.0,
      highDangerLevel: 14.0,
    })
    expect(result.success).toBe(false)
  })

  it('accepts the oil_press_bar pattern (low-side: warn 1.5, danger 1.0)', () => {
    const result = SignalDefSchema.safeParse({
      ...BASE,
      min: 0,
      max: 10,
      warningLevel: 1.5,
      dangerLevel: 1.0,
    })
    expect(result.success).toBe(true)
  })
})

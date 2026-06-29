import { parseConversion } from '../can-xml/conversion-parse.js'

describe('parseConversion — linear detection (compileExpr-backed)', () => {
  it('treats a bare V as identity', () => {
    expect(parseConversion('V')).toEqual({ kind: 'linear', scale: 1, offset: 0, bitShift: null })
  })

  it('detects a pure scale', () => {
    expect(parseConversion('V*0.1')).toEqual({
      kind: 'linear',
      scale: 0.1,
      offset: 0,
      bitShift: null,
    })
  })

  it('detects scale + offset', () => {
    const r = parseConversion('V*0.1-40')
    expect(r.kind).toBe('linear')
    if (r.kind === 'linear') {
      expect(r.scale).toBeCloseTo(0.1, 9)
      expect(r.offset).toBe(-40)
      expect(r.bitShift).toBeNull()
    }
  })

  it('detects division as a fractional scale', () => {
    const r = parseConversion('V/10')
    expect(r.kind).toBe('linear')
    if (r.kind === 'linear') expect(r.scale).toBeCloseTo(0.1, 9)
  })

  it('detects a negative scale', () => {
    expect(parseConversion('100-V')).toEqual({
      kind: 'linear',
      scale: -1,
      offset: 100,
      bitShift: null,
    })
  })

  it('resolves parentheses and precedence', () => {
    expect(parseConversion('(V+1)*2')).toEqual({
      kind: 'linear',
      scale: 2,
      offset: 2,
      bitShift: null,
    })
  })

  it('treats a constant as a zero-scale linear conversion', () => {
    expect(parseConversion('42')).toEqual({ kind: 'linear', scale: 0, offset: 42, bitShift: null })
  })
})

describe('parseConversion — non-linear / expr emission', () => {
  it('emits V*V as an expression (not mis-detected as linear)', () => {
    expect(parseConversion('V*V')).toEqual({ kind: 'expr', expr: 'V*V' })
  })

  it('emits byte-ref expressions instead of mis-detecting them as a zero scale', () => {
    const r = parseConversion('B0+B1*256')
    expect(r.kind).toBe('expr')
  })
})

describe('parseConversion — bit extraction', () => {
  it('maps V>>3 to a bit shift', () => {
    expect(parseConversion('V>>3')).toEqual({ kind: 'linear', scale: 1, offset: 0, bitShift: 3 })
  })

  it('maps V&0x04 to the corresponding bit index', () => {
    expect(parseConversion('V&0x04')).toEqual({ kind: 'linear', scale: 1, offset: 0, bitShift: 2 })
  })
})

describe('parseConversion — empty / default', () => {
  it('treats an empty conversion as identity', () => {
    expect(parseConversion('')).toEqual({ kind: 'linear', scale: 1, offset: 0, bitShift: null })
  })

  it('treats a missing conversion as identity', () => {
    expect(parseConversion(undefined)).toEqual({
      kind: 'linear',
      scale: 1,
      offset: 0,
      bitShift: null,
    })
  })
})

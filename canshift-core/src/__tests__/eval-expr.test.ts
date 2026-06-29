import { describe, expect, it } from '@jest/globals'
import { evalExpr } from '../can-xml/eval-expr.js'

const ctx = (v: number, bytes: number[] = []) => ({ v, bytes })

describe('evalExpr — primaries', () => {
  it('numbers', () => {
    expect(evalExpr('42', ctx(0))).toBe(42)
    expect(evalExpr('3.14', ctx(0))).toBeCloseTo(3.14)
    expect(evalExpr('0xFF', ctx(0))).toBe(255)
  })

  it('V identifier', () => {
    expect(evalExpr('V', ctx(7))).toBe(7)
  })

  it('byte identifiers B0..B7', () => {
    const bytes = [10, 20, 30, 40, 50, 60, 70, 80]
    expect(evalExpr('B0', ctx(0, bytes))).toBe(10)
    expect(evalExpr('B3', ctx(0, bytes))).toBe(40)
    expect(evalExpr('B7', ctx(0, bytes))).toBe(80)
  })

  it('parens', () => {
    expect(evalExpr('(2+3)*4', ctx(0))).toBe(20)
  })
})

describe('evalExpr — arithmetic', () => {
  it('mul/div/mod', () => {
    expect(evalExpr('6*7', ctx(0))).toBe(42)
    expect(evalExpr('20/4', ctx(0))).toBe(5)
    expect(evalExpr('17%5', ctx(0))).toBe(2)
  })

  it('add/sub left-to-right', () => {
    expect(evalExpr('10-3-2', ctx(0))).toBe(5)
  })

  it('unary minus / plus / bang', () => {
    expect(evalExpr('-5+10', ctx(0))).toBe(5)
    expect(evalExpr('+3*+4', ctx(0))).toBe(12)
    expect(evalExpr('!0', ctx(0))).toBe(1)
    expect(evalExpr('!1', ctx(0))).toBe(0)
  })

  it('precedence: */ over +-', () => {
    expect(evalExpr('2+3*4', ctx(0))).toBe(14)
  })
})

describe('evalExpr — bit ops & shifts', () => {
  it('shifts', () => {
    expect(evalExpr('1<<4', ctx(0))).toBe(16)
    expect(evalExpr('256>>4', ctx(0))).toBe(16)
  })

  it('and/or/xor', () => {
    expect(evalExpr('0xFF&0x0F', ctx(0))).toBe(0x0f)
    expect(evalExpr('0xF0|0x0F', ctx(0))).toBe(0xff)
    expect(evalExpr('0xFF^0x0F', ctx(0))).toBe(0xf0)
  })
})

describe('evalExpr — comparisons', () => {
  it('equality', () => {
    expect(evalExpr('V==0xD7', ctx(0xd7))).toBe(1)
    expect(evalExpr('V==0xD7', ctx(0))).toBe(0)
    expect(evalExpr('V!=0', ctx(5))).toBe(1)
  })

  it('relational', () => {
    expect(evalExpr('V>10', ctx(20))).toBe(1)
    expect(evalExpr('V<=10', ctx(10))).toBe(1)
    expect(evalExpr('V>=10', ctx(5))).toBe(0)
  })
})

describe('evalExpr — functions', () => {
  it('Floor/Ceil/Round', () => {
    expect(evalExpr('Floor(3.7)', ctx(0))).toBe(3)
    expect(evalExpr('Ceil(3.2)', ctx(0))).toBe(4)
    expect(evalExpr('Round(3.5)', ctx(0))).toBe(4)
  })

  it('Floor(V/200)/2 * 100', () => {
    expect(evalExpr('(Floor(V/200)/2)*100', ctx(401))).toBe(100)
    expect(evalExpr('(Floor(V/200)/2)*100', ctx(199))).toBe(0)
  })
})

describe('evalExpr — catalogue patterns', () => {
  it('boolean equality OR (V=0xD7) || (V=0xEF) — encoded as ==', () => {
    expect(evalExpr('(V==0xD7)|(V==0xEF)', ctx(0xd7))).toBe(1)
    expect(evalExpr('(V==0xD7)|(V==0xEF)', ctx(0xef))).toBe(1)
    expect(evalExpr('(V==0xD7)|(V==0xEF)', ctx(0))).toBe(0)
  })

  it('bit-extract * scale: (V & 1) * 100', () => {
    expect(evalExpr('(V&1)*100', ctx(0))).toBe(0)
    expect(evalExpr('(V&1)*100', ctx(1))).toBe(100)
  })

  it('multi-byte composite: 14.7*(B0/117)', () => {
    expect(evalExpr('14.7*(B0/117)', ctx(0, [117]))).toBeCloseTo(14.7)
    expect(evalExpr('14.7*(B0/117)', ctx(0, [0]))).toBe(0)
  })

  it('big-coefficient: 0.003867973182*(B0*256+B2)-47.57', () => {
    const v = 0.003867973182 * (100 * 256 + 50) - 47.57
    expect(evalExpr('0.003867973182*(B0*256+B2)-47.57', ctx(0, [100, 0, 50]))).toBeCloseTo(v)
  })
})

describe('evalExpr — error paths', () => {
  it('returns 0 for empty / invalid', () => {
    expect(evalExpr('', ctx(0))).toBe(0)
    expect(evalExpr('@@@', ctx(0))).toBe(0)
  })

  it('returns 0 for divide-by-zero / NaN', () => {
    expect(evalExpr('1/0', ctx(0))).toBe(0)
  })

  it('handles missing bytes as zero', () => {
    expect(evalExpr('B7', ctx(0, []))).toBe(0)
  })
})

describe('evalExpr — untrusted input hardening (#1654)', () => {
  it('does not throw on deeply nested parentheses within the 128-char cap', () => {
    const depth = 60
    const expr = '('.repeat(depth) + 'V' + ')'.repeat(depth)
    expect(expr.length).toBeLessThanOrEqual(128)
    expect(evalExpr(expr, ctx(7))).toBe(7)
  })

  it('returns 0 for an expression longer than the 128-char cap', () => {
    const expr = '1+'.repeat(80) + '1'
    expect(expr.length).toBeGreaterThan(128)
    expect(evalExpr(expr, ctx(0))).toBe(0)
  })

  it('returns 0 (no throw) for malformed input', () => {
    expect(evalExpr('((((', ctx(0))).toBe(0)
    expect(evalExpr('@#$%', ctx(0))).toBe(0)
  })
})

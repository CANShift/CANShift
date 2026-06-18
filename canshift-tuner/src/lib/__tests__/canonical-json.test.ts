import { describe, expect, it } from 'vitest'
import { canonicalStringify } from '../canonical-json'

describe('canonicalStringify', () => {
  it('matches plain stringify for primitives', () => {
    expect(canonicalStringify(42)).toBe('42')
    expect(canonicalStringify('hello')).toBe('"hello"')
    expect(canonicalStringify(true)).toBe('true')
    expect(canonicalStringify(null)).toBe('null')
  })

  it('normalises key order for objects', () => {
    const a = { b: 1, a: 2, c: 3 }
    const b = { c: 3, a: 2, b: 1 }
    expect(canonicalStringify(a)).toBe(canonicalStringify(b))
  })

  it('preserves array order', () => {
    expect(canonicalStringify([3, 1, 2])).toBe('[3,1,2]')
  })

  it('handles nested objects', () => {
    const a = { x: { b: 1, a: 2 }, y: [{ d: 4, c: 3 }] }
    const b = { y: [{ c: 3, d: 4 }], x: { a: 2, b: 1 } }
    expect(canonicalStringify(a)).toBe(canonicalStringify(b))
  })

  it('detects content differences', () => {
    expect(canonicalStringify({ a: 1 })).not.toBe(canonicalStringify({ a: 2 }))
    expect(canonicalStringify([1, 2])).not.toBe(canonicalStringify([1, 2, 3]))
  })
})

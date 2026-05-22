// hex.test.ts — shared `#RRGGBB` regex + type-guard (audit C-ME-4, #1016).
//
// Locks the contract that three former private hex regexes used to enforce
// (sensor-defaults, design-tokens, migration-runner). One regression test
// here protects every call site at once.

import { HEX_REGEX, isHexColor } from '../colors/hex.js'

describe('HEX_REGEX', () => {
  it.each(['#000000', '#FFFFFF', '#ff4444', '#aBcDeF'])('accepts %s', (input) => {
    expect(HEX_REGEX.test(input)).toBe(true)
  })

  it.each(['', '#', '#FFF', '#FFFFFFF', 'FFFFFF', '#GGGGGG', '#FF FFFF', ' #FFFFFF', '#FFFFFF '])(
    'rejects %s',
    (input) => {
      expect(HEX_REGEX.test(input)).toBe(false)
    }
  )

  it('captures the 6 hex digits without the leading hash', () => {
    expect(HEX_REGEX.exec('#FF4444')?.[1]).toBe('FF4444')
  })
})

describe('isHexColor', () => {
  it('returns true for a valid `#RRGGBB`', () => {
    expect(isHexColor('#FF4444')).toBe(true)
  })

  it('returns false for an invalid string', () => {
    expect(isHexColor('not-a-color')).toBe(false)
  })

  it('narrows the type so `as HexColor` is not required', () => {
    // Compile-time check — if `isHexColor` ever loses its `is` predicate, this
    // block stops typechecking. Runtime assertion just keeps Jest happy.
    const candidate: unknown = '#FF4444'
    if (typeof candidate === 'string' && isHexColor(candidate)) {
      const accepts = (_: `#${string}`): void => {
        void _
      }
      accepts(candidate)
      expect(candidate.startsWith('#')).toBe(true)
    } else {
      throw new Error('expected `#FF4444` to be a valid hex color')
    }
  })
})

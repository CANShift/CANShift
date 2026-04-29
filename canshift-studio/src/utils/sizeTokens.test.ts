// sizeTokens.test.ts — unit tests for the size token system

import { describe, it, expect } from 'vitest'
import {
  SIZE_TOKENS,
  SIZE_TOKEN_LIST,
  tokenFromDimensions,
  gaugeTokenIds,
  STANDARD_TOKEN_IDS,
  GAUGE_DEFAULT_TOKEN,
} from './sizeTokens'

// ---------------------------------------------------------------------------
// SIZE_TOKENS catalogue
// ---------------------------------------------------------------------------

describe('SIZE_TOKENS', () => {
  it('all tokens have correct w and h', () => {
    expect(SIZE_TOKENS.XXL).toMatchObject({ w: 160, h: 224 })
    expect(SIZE_TOKENS.XL).toMatchObject({ w: 160, h: 112 })
    expect(SIZE_TOKENS.L).toMatchObject({ w: 160, h: 56 })
    expect(SIZE_TOKENS.H).toMatchObject({ w: 160, h: 28 })
    expect(SIZE_TOKENS['H-FULL']).toMatchObject({ w: 320, h: 28 })
    expect(SIZE_TOKENS.M).toMatchObject({ w: 80, h: 112 })
    expect(SIZE_TOKENS.S).toMatchObject({ w: 80, h: 56 })
    expect(SIZE_TOKENS.XS).toMatchObject({ w: 80, h: 28 })
    expect(SIZE_TOKENS.V).toMatchObject({ w: 40, h: 224 })
    expect(SIZE_TOKENS['V-M']).toMatchObject({ w: 40, h: 112 })
    expect(SIZE_TOKENS['V-S']).toMatchObject({ w: 40, h: 56 })
  })

  it('each token id matches its key', () => {
    for (const [key, token] of Object.entries(SIZE_TOKENS)) {
      expect(token.id).toBe(key)
    }
  })
})

describe('SIZE_TOKEN_LIST', () => {
  it('contains all 11 tokens', () => {
    expect(SIZE_TOKEN_LIST).toHaveLength(11)
  })

  it('matches SIZE_TOKENS values', () => {
    const listIds = SIZE_TOKEN_LIST.map((t) => t.id).sort()
    const mapIds = Object.keys(SIZE_TOKENS).sort()
    expect(listIds).toEqual(mapIds)
  })
})

// ---------------------------------------------------------------------------
// tokenFromDimensions
// ---------------------------------------------------------------------------

describe('tokenFromDimensions', () => {
  it('returns correct token id for known dimensions', () => {
    expect(tokenFromDimensions(160, 224)).toBe('XXL')
    expect(tokenFromDimensions(160, 112)).toBe('XL')
    expect(tokenFromDimensions(320, 28)).toBe('H-FULL')
    expect(tokenFromDimensions(40, 224)).toBe('V')
  })

  it('returns null for non-standard dimensions', () => {
    expect(tokenFromDimensions(100, 100)).toBeNull()
    expect(tokenFromDimensions(0, 0)).toBeNull()
    expect(tokenFromDimensions(160, 111)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// gaugeTokenIds
// ---------------------------------------------------------------------------

describe('gaugeTokenIds', () => {
  it('returns XL and XXL for arc gauges', () => {
    expect(gaugeTokenIds('arc')).toEqual(['XL', 'XXL'])
  })

  it('returns numeric-friendly tokens for numeric display', () => {
    const ids = gaugeTokenIds('numeric')
    expect(ids).toContain('XL')
    expect(ids).toContain('S')
    expect(ids).not.toContain('H-FULL')
  })

  it('returns H-FULL for horizontal bar', () => {
    expect(gaugeTokenIds('bar', 'horizontal')).toContain('H-FULL')
  })

  it('returns vertical tokens for vertical bar', () => {
    const ids = gaugeTokenIds('bar', 'vertical')
    expect(ids).toContain('V')
    expect(ids).toContain('V-M')
    expect(ids).not.toContain('H-FULL')
  })

  it('excludes V-S from all bar orientations (too small)', () => {
    expect(gaugeTokenIds('bar', 'horizontal')).not.toContain('V-S')
    expect(gaugeTokenIds('bar', 'vertical')).not.toContain('V-S')
  })
})

// ---------------------------------------------------------------------------
// GAUGE_DEFAULT_TOKEN
// ---------------------------------------------------------------------------

describe('GAUGE_DEFAULT_TOKEN', () => {
  it('maps arc to XL', () => {
    expect(GAUGE_DEFAULT_TOKEN.arc).toBe('XL')
  })

  it('maps bar to S', () => {
    expect(GAUGE_DEFAULT_TOKEN.bar).toBe('S')
  })

  it('maps numeric to L', () => {
    expect(GAUGE_DEFAULT_TOKEN.numeric).toBe('L')
  })
})

// ---------------------------------------------------------------------------
// STANDARD_TOKEN_IDS
// ---------------------------------------------------------------------------

describe('STANDARD_TOKEN_IDS', () => {
  it('contains expected tokens', () => {
    expect(STANDARD_TOKEN_IDS).toContain('XL')
    expect(STANDARD_TOKEN_IDS).toContain('S')
    expect(STANDARD_TOKEN_IDS).toContain('XS')
  })

  it('does not contain wide or tall outliers', () => {
    expect(STANDARD_TOKEN_IDS).not.toContain('H-FULL')
    expect(STANDARD_TOKEN_IDS).not.toContain('XXL')
    expect(STANDARD_TOKEN_IDS).not.toContain('V')
  })
})

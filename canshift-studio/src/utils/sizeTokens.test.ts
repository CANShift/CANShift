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
    expect(SIZE_TOKENS['H-FULL']).toMatchObject({ w: 320, h: 56 })
    expect(SIZE_TOKENS.V).toMatchObject({ w: 40, h: 224 })
    expect(SIZE_TOKENS['V-M']).toMatchObject({ w: 40, h: 112 })
  })

  it('each token id matches its key', () => {
    for (const [key, token] of Object.entries(SIZE_TOKENS)) {
      expect(token.id).toBe(key)
    }
  })

  it('does not contain dropped small tokens (XS / S / M / H / V-S)', () => {
    expect('XS' in SIZE_TOKENS).toBe(false)
    expect('S' in SIZE_TOKENS).toBe(false)
    expect('M' in SIZE_TOKENS).toBe(false)
    expect('H' in SIZE_TOKENS).toBe(false)
    expect('V-S' in SIZE_TOKENS).toBe(false)
  })
})

describe('SIZE_TOKEN_LIST', () => {
  it('contains all 6 tokens', () => {
    expect(SIZE_TOKEN_LIST).toHaveLength(6)
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
    expect(tokenFromDimensions(160, 56)).toBe('L')
    expect(tokenFromDimensions(320, 56)).toBe('H-FULL')
    expect(tokenFromDimensions(40, 224)).toBe('V')
    expect(tokenFromDimensions(40, 112)).toBe('V-M')
  })

  it('returns null for non-standard dimensions', () => {
    expect(tokenFromDimensions(100, 100)).toBeNull()
    expect(tokenFromDimensions(0, 0)).toBeNull()
    expect(tokenFromDimensions(160, 111)).toBeNull()
  })

  it('returns null for legacy small dimensions (XS / S / M)', () => {
    expect(tokenFromDimensions(80, 28)).toBeNull()
    expect(tokenFromDimensions(80, 56)).toBeNull()
    expect(tokenFromDimensions(80, 112)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// gaugeTokenIds
// ---------------------------------------------------------------------------

describe('gaugeTokenIds', () => {
  it('returns XL and XXL for arc gauges', () => {
    expect(gaugeTokenIds('arc')).toEqual(['XL', 'XXL'])
  })

  it('returns only XL and L for numeric display', () => {
    expect(gaugeTokenIds('numeric')).toEqual(['XL', 'L'])
  })

  it('returns H-FULL for horizontal bar', () => {
    expect(gaugeTokenIds('bar', 'horizontal')).toEqual(['H-FULL'])
  })

  it('returns vertical narrow tokens for vertical bar', () => {
    expect(gaugeTokenIds('bar', 'vertical')).toEqual(['V-M', 'V'])
  })
})

// ---------------------------------------------------------------------------
// GAUGE_DEFAULT_TOKEN
// ---------------------------------------------------------------------------

describe('GAUGE_DEFAULT_TOKEN', () => {
  it('maps arc to XL', () => {
    expect(GAUGE_DEFAULT_TOKEN.arc).toBe('XL')
  })

  it('maps bar to V-M', () => {
    expect(GAUGE_DEFAULT_TOKEN.bar).toBe('V-M')
  })

  it('maps numeric to L', () => {
    expect(GAUGE_DEFAULT_TOKEN.numeric).toBe('L')
  })
})

// ---------------------------------------------------------------------------
// STANDARD_TOKEN_IDS
// ---------------------------------------------------------------------------

describe('STANDARD_TOKEN_IDS', () => {
  it('contains only XL and L', () => {
    expect(STANDARD_TOKEN_IDS).toEqual(['XL', 'L'])
  })

  it('does not contain dropped or specialty tokens', () => {
    expect(STANDARD_TOKEN_IDS).not.toContain('XS')
    expect(STANDARD_TOKEN_IDS).not.toContain('S')
    expect(STANDARD_TOKEN_IDS).not.toContain('M')
    expect(STANDARD_TOKEN_IDS).not.toContain('H-FULL')
    expect(STANDARD_TOKEN_IDS).not.toContain('XXL')
    expect(STANDARD_TOKEN_IDS).not.toContain('V')
  })
})

// font-family.test.ts — Regression tests for the font-family schema +
// catalog (issues #971 + #500).
//
// Coverage:
//   - `FontFamilyIdSchema` accepts the registered id and rejects unknown
//     values.
//   - `FONT_FAMILIES` catalog is non-empty and exposes the default id.
//   - `getFontFamily` returns the catalog row for a valid id.
//   - `resolveFontFamily(undefined)` falls back to the default id (the
//     backward-compatibility contract relied on by every existing
//     dashboard).

import {
  DEFAULT_FONT_FAMILY_ID,
  FONT_FAMILIES,
  FontFamilyIdSchema,
  getFontFamily,
  resolveFontFamily,
} from '../schemas/font-family.js'

describe('FontFamilyIdSchema', () => {
  it('accepts the registered "orbitron" id', () => {
    const result = FontFamilyIdSchema.safeParse('orbitron')
    expect(result.success).toBe(true)
  })

  it('rejects an unknown font family id', () => {
    const result = FontFamilyIdSchema.safeParse('comic-sans')
    expect(result.success).toBe(false)
  })

  it('rejects a non-string value', () => {
    const result = FontFamilyIdSchema.safeParse(42)
    expect(result.success).toBe(false)
  })
})

describe('FONT_FAMILIES catalog', () => {
  it('is non-empty', () => {
    expect(FONT_FAMILIES.length).toBeGreaterThan(0)
  })

  it('exposes the default family id', () => {
    // String widening keeps the predicate non-tautological for the type
    // checker (lint: no-unnecessary-condition) — same pattern used in
    // `SCREEN_PROFILES` tests.
    const needle: string = DEFAULT_FONT_FAMILY_ID
    const found = FONT_FAMILIES.find((entry) => (entry.id as string) === needle)
    expect(found).toBeDefined()
  })

  it('every entry parses through FontFamilyIdSchema', () => {
    for (const entry of FONT_FAMILIES) {
      const result = FontFamilyIdSchema.safeParse(entry.id)
      expect(result.success).toBe(true)
    }
  })

  it('every entry exposes a non-empty displayName and description', () => {
    for (const entry of FONT_FAMILIES) {
      expect(entry.displayName.length).toBeGreaterThan(0)
      expect(entry.description.length).toBeGreaterThan(0)
    }
  })
})

describe('getFontFamily / resolveFontFamily', () => {
  it('returns the catalog row for the default id', () => {
    const entry = getFontFamily(DEFAULT_FONT_FAMILY_ID)
    expect(entry.id).toBe(DEFAULT_FONT_FAMILY_ID)
    expect(entry.displayName).toBe('Orbitron')
  })

  it('falls back to the default family when fontFamily is undefined', () => {
    const entry = resolveFontFamily(undefined)
    expect(entry.id).toBe(DEFAULT_FONT_FAMILY_ID)
  })

  it('returns the requested family when an id is supplied', () => {
    const entry = resolveFontFamily('orbitron')
    expect(entry.id).toBe('orbitron')
  })
})

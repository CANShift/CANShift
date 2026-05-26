// screen-profile.test.ts — Regression tests for the screen-profile schema +
// catalog (issue #548).
//
// Coverage:
//   - `ScreenProfileIdSchema` accepts the registered id and rejects unknown
//     values.
//   - `ScreenProfileSchema` accepts a well-formed entry; rejects bad shape.
//   - `SCREEN_PROFILES` catalog is non-empty and each entry parses through
//     the schema (the catalog can never silently drift from the schema).
//   - `getScreenProfile` returns the catalog row for a valid id.
//   - `resolveScreenProfile(undefined)` falls back to the default id.

import {
  DEFAULT_SCREEN_PROFILE_ID,
  SCREEN_PROFILES,
  ScreenProfileIdSchema,
  ScreenProfileSchema,
  getScreenProfile,
  resolveScreenProfile,
} from '../schemas/screen-profile.js'

describe('ScreenProfileIdSchema', () => {
  it('accepts the registered "crowpanel-28" id', () => {
    const result = ScreenProfileIdSchema.safeParse('crowpanel-28')
    expect(result.success).toBe(true)
  })

  it('rejects an unknown profile id', () => {
    const result = ScreenProfileIdSchema.safeParse('crowpanel-99')
    expect(result.success).toBe(false)
  })
})

describe('ScreenProfileSchema', () => {
  it('accepts a well-formed profile entry', () => {
    const result = ScreenProfileSchema.safeParse({
      id: 'crowpanel-28',
      name: 'CrowPanel 2.8"',
      width: 320,
      height: 240,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a non-positive width', () => {
    const result = ScreenProfileSchema.safeParse({
      id: 'crowpanel-28',
      name: 'CrowPanel 2.8"',
      width: 0,
      height: 240,
    })
    expect(result.success).toBe(false)
  })

  it('rejects extra (unknown) fields under strict mode', () => {
    const result = ScreenProfileSchema.safeParse({
      id: 'crowpanel-28',
      name: 'CrowPanel 2.8"',
      width: 320,
      height: 240,
      dpi: 200,
    })
    expect(result.success).toBe(false)
  })
})

describe('SCREEN_PROFILES catalog', () => {
  it('is non-empty', () => {
    expect(SCREEN_PROFILES.length).toBeGreaterThan(0)
  })

  it('parses every entry through ScreenProfileSchema', () => {
    for (const profile of SCREEN_PROFILES) {
      const result = ScreenProfileSchema.safeParse(profile)
      expect(result.success).toBe(true)
    }
  })

  it('exposes the default profile id', () => {
    // The cast widens the literal so the `find` predicate isn't collapsed to
    // a tautology by the type checker (lint: no-unnecessary-condition).
    const needle: string = DEFAULT_SCREEN_PROFILE_ID
    const found = SCREEN_PROFILES.find((p) => (p.id as string) === needle)
    expect(found).toBeDefined()
  })
})

describe('getScreenProfile / resolveScreenProfile', () => {
  it('returns the catalog row for the default id', () => {
    const profile = getScreenProfile(DEFAULT_SCREEN_PROFILE_ID)
    expect(profile.id).toBe(DEFAULT_SCREEN_PROFILE_ID)
    expect(profile.width).toBe(320)
    expect(profile.height).toBe(240)
  })

  it('falls back to the default profile when targetProfile is undefined', () => {
    const profile = resolveScreenProfile(undefined)
    expect(profile.id).toBe(DEFAULT_SCREEN_PROFILE_ID)
  })

  it('returns the requested profile when an id is supplied', () => {
    const profile = resolveScreenProfile('crowpanel-28')
    expect(profile.id).toBe('crowpanel-28')
  })
})

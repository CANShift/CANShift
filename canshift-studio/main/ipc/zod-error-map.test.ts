// zod-error-map.test.ts — coverage for the friendly Zod error formatting
// added by #832.
//
// @vitest-environment node

import { describe, it, expect, beforeAll } from 'vitest'
import { z } from 'zod'
import {
  friendlyZodErrorMap,
  friendlyZodIssues,
  installFriendlyZodErrorMap,
  summarizeZodError,
} from './zod-error-map'

beforeAll(() => {
  installFriendlyZodErrorMap()
})

describe('friendlyZodErrorMap', () => {
  it('rewrites invalid_type when the value is missing', () => {
    const schema = z.object({ canSpeedKbps: z.number() }).strict()
    const result = schema.safeParse({})
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('required field is missing')
    }
  })

  it('rewrites invalid_type when the value is the wrong type', () => {
    const schema = z.object({ canSpeedKbps: z.number() }).strict()
    const result = schema.safeParse({ canSpeedKbps: '500' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('expected number, got string')
    }
  })

  it('rewrites invalid_enum_value with the list of allowed options', () => {
    const schema = z.enum(['low', 'high'])
    const result = schema.safeParse('medium')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('must be one of: low, high')
    }
  })

  it('rewrites too_small for numbers', () => {
    const schema = z.number().min(1)
    const result = schema.safeParse(0)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('must be ≥ 1')
    }
  })

  it('rewrites too_big for arrays', () => {
    const schema = z.array(z.number()).max(2)
    const result = schema.safeParse([1, 2, 3])
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('cannot exceed 2 entries')
    }
  })

  it('rewrites unrecognized_keys with the offending key', () => {
    const schema = z.object({ a: z.number() }).strict()
    const result = schema.safeParse({ a: 1, mystery: true })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('unknown field: mystery')
    }
  })

  it('passes through custom refine() messages verbatim', () => {
    const schema = z.number().refine((n) => n % 2 === 0, { message: 'must be even' })
    const result = schema.safeParse(3)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('must be even')
    }
  })

  it('does not throw when the issue code is unknown', () => {
    // Synthetic call — make sure the default branch returns something.
    const out = friendlyZodErrorMap(
      { code: z.ZodIssueCode.invalid_intersection_types, path: [], message: '' },
      { defaultError: 'fallback', data: {} }
    )
    expect(out.message).toBe('fallback')
  })
})

describe('friendlyZodIssues', () => {
  it('emits a label that translates known top-level paths', () => {
    const schema = z.object({ canSpeedKbps: z.number() }).strict()
    const result = schema.safeParse({ canSpeedKbps: 'fast' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issues = friendlyZodIssues(result.error)
      expect(issues[0]?.label).toBe('CAN bus speed')
    }
  })

  it('uses one-based array indices in nested paths', () => {
    const schema = z.object({
      pages: z.array(z.object({ id: z.string() })),
    })
    const result = schema.safeParse({ pages: [{ id: 'a' }, { id: 42 }] })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issues = friendlyZodIssues(result.error)
      expect(issues[0]?.label).toBe('page list → #2 → id')
    }
  })

  it('falls back to the raw segment when the key has no label', () => {
    const schema = z.object({ foobar: z.number() })
    const result = schema.safeParse({ foobar: 'no' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issues = friendlyZodIssues(result.error)
      expect(issues[0]?.label).toBe('foobar')
    }
  })
})

describe('summarizeZodError', () => {
  it('formats a single issue as `label: message`', () => {
    const schema = z.object({ twaiTxPin: z.number() }).strict()
    const result = schema.safeParse({ twaiTxPin: '22' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(summarizeZodError(result.error)).toBe('TWAI TX pin: expected number, got string')
    }
  })

  it('appends a (+N more) suffix when multiple issues are present', () => {
    const schema = z.object({ a: z.number(), b: z.number() }).strict()
    const result = schema.safeParse({ a: 'x', b: 'y' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(summarizeZodError(result.error)).toMatch(/\(\+1 more\)$/)
    }
  })

  it('returns a plain message for root-level issues (empty path)', () => {
    const schema = z.string()
    const result = schema.safeParse(42)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(summarizeZodError(result.error)).toBe('expected string, got number')
    }
  })
})

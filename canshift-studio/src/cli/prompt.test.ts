// src/cli/prompt.test.ts — Cover the prompt builder's branching: host
// selection, slugification edge cases, and exit-status colour toggling.

import { describe, expect, it } from 'vitest'
import { buildPrompt, slugifyHost } from './prompt'

describe('slugifyHost', () => {
  it('keeps allowed characters and lowercases the result', () => {
    expect(slugifyHost('My-Car_v2.0')).toBe('my-car_v2.0')
  })

  it('collapses runs of invalid characters to a single hyphen', () => {
    expect(slugifyHost('Track  //  Day ?? 1')).toBe('track-day-1')
  })

  it('trims leading/trailing hyphens introduced by slugification', () => {
    expect(slugifyHost('!! awesome !!')).toBe('awesome')
  })

  it('caps the slug at 32 characters', () => {
    const long = 'a'.repeat(40)
    expect(slugifyHost(long)).toHaveLength(32)
  })

  it('returns an empty string for whitespace-only input', () => {
    expect(slugifyHost('   ')).toBe('')
  })
})

describe('buildPrompt', () => {
  it('uses the slugified config name when connected and named', () => {
    const out = buildPrompt({ connected: true, configName: 'My Car', lastExitOk: true })
    expect(out).toContain('canshift@my-car')
    // Default-coloured `%` (no red ANSI in the trailing region).
    expect(out).not.toContain('\x1b[31m')
  })

  it("falls back to '(unnamed)' when connected but config name is empty", () => {
    const out = buildPrompt({ connected: true, configName: '', lastExitOk: true })
    expect(out).toContain('canshift@(unnamed)')
  })

  it("falls back to '(unnamed)' when connected but slug ends up empty", () => {
    const out = buildPrompt({ connected: true, configName: '!!!', lastExitOk: true })
    expect(out).toContain('canshift@(unnamed)')
  })

  it("uses '(disconnected)' when not connected", () => {
    const out = buildPrompt({ connected: false, configName: 'ignored', lastExitOk: true })
    expect(out).toContain('canshift@(disconnected)')
  })

  it('paints the trailing % red when the previous command failed', () => {
    const ok = buildPrompt({ connected: true, configName: 'foo', lastExitOk: true })
    const fail = buildPrompt({ connected: true, configName: 'foo', lastExitOk: false })
    expect(fail).toContain('\x1b[31m%')
    expect(ok).not.toContain('\x1b[31m%')
  })

  it('paints canshift@host green and resets after the host segment', () => {
    const out = buildPrompt({ connected: true, configName: 'foo', lastExitOk: true })
    expect(out.startsWith('\x1b[32mcanshift@foo\x1b[0m')).toBe(true)
  })
})

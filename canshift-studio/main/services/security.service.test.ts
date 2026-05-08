// security.service.test.ts — coverage for the openExternal scheme allowlist (#212).
//
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { isExternalUrlAllowed } from './security.service'

describe('isExternalUrlAllowed — scheme allowlist for shell.openExternal', () => {
  it('allows https:// in prod', () => {
    expect(isExternalUrlAllowed('https://github.com/tburkhalterr/CANShift', false)).toBe(true)
  })

  it('allows http:// in dev', () => {
    expect(isExternalUrlAllowed('http://localhost:5173', true)).toBe(true)
  })

  it('denies http:// in prod', () => {
    expect(isExternalUrlAllowed('http://example.com', false)).toBe(false)
  })

  it('denies file://', () => {
    expect(isExternalUrlAllowed('file:///etc/passwd', false)).toBe(false)
    expect(isExternalUrlAllowed('file:///etc/passwd', true)).toBe(false)
  })

  it('denies javascript:', () => {
    expect(isExternalUrlAllowed('javascript:alert(1)', true)).toBe(false)
  })

  it('denies custom shell protocols (vbs:, ms-cxh:, etc.)', () => {
    expect(isExternalUrlAllowed('vbs:Set-WshShell', true)).toBe(false)
    expect(isExternalUrlAllowed('ms-cxh://reset', true)).toBe(false)
  })

  it('denies malformed URLs without throwing', () => {
    expect(isExternalUrlAllowed('not a url', true)).toBe(false)
    expect(isExternalUrlAllowed('', true)).toBe(false)
    expect(isExternalUrlAllowed('://missing-protocol', true)).toBe(false)
  })

  it('denies non-http(s) schemes (ftp, etc.) regardless of mode', () => {
    expect(isExternalUrlAllowed('ftp://files.example.com', false)).toBe(false)
    expect(isExternalUrlAllowed('ftp://files.example.com', true)).toBe(false)
  })
})

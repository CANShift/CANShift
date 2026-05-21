// security.service.test.ts — coverage for the openExternal scheme allowlist (#212).
//
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { __csp, isExternalUrlAllowed } from './security.service'

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

describe('Content-Security-Policy — style-src hardening (#900)', () => {
  it('prod CSP forbids inline <style> blocks (style-src has no unsafe-inline)', () => {
    expect(__csp.PROD_CSP).toContain("style-src 'self'")
    expect(__csp.PROD_CSP).not.toContain("style-src 'self' 'unsafe-inline'")
  })

  it('prod CSP still allows inline style="" attributes via style-src-attr (Radix popper/portals)', () => {
    expect(__csp.PROD_CSP).toContain("style-src-attr 'unsafe-inline'")
  })

  it('dev CSP keeps unsafe-inline on style-src so Vite HMR can inject <style>', () => {
    expect(__csp.DEV_CSP).toContain("style-src 'self' 'unsafe-inline'")
  })

  it('prod script-src is locked to self with no unsafe-inline / unsafe-eval', () => {
    expect(__csp.PROD_CSP).toContain("script-src 'self'")
    expect(__csp.PROD_CSP).not.toMatch(/script-src[^;]*unsafe-(inline|eval)/)
  })

  it('dev script-src allows unsafe-inline so @vitejs/plugin-react preamble runs', () => {
    // React Fast Refresh injects an inline preamble script that Vite cannot
    // pre-hash or move to a separate file. Blocking it leaves the renderer
    // grey on mount (preamble throws → React never starts). Dev is local-only
    // so the practical XSS surface is nil.
    expect(__csp.DEV_CSP).toContain("script-src 'self' 'unsafe-inline'")
    // unsafe-eval is still forbidden — Vite doesn't need it.
    expect(__csp.DEV_CSP).not.toMatch(/script-src[^;]*unsafe-eval/)
  })
})

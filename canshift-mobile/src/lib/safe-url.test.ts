// safe-url.test.ts — Boundary coverage for the URL-scheme allowlist guard
// that fronts every Linking.openURL call site (security fix #1013).

import { isAllowedExternalUrl } from './safe-url'

describe('isAllowedExternalUrl — allowed schemes', () => {
  it('accepts https URLs', () => {
    expect(
      isAllowedExternalUrl('https://github.com/tburkhalterr/CANShift/releases/tag/v1.0.0')
    ).toBe(true)
  })

  it('accepts http URLs', () => {
    expect(isAllowedExternalUrl('http://example.com')).toBe(true)
  })

  it('accepts mailto URLs', () => {
    expect(isAllowedExternalUrl('mailto:hello@example.com')).toBe(true)
  })

  it('accepts mailto with a body query', () => {
    expect(isAllowedExternalUrl('mailto:hello@example.com?subject=hi&body=ok')).toBe(true)
  })
})

describe('isAllowedExternalUrl — blocked schemes', () => {
  it('rejects tel: (auto-dial)', () => {
    expect(isAllowedExternalUrl('tel:+15551234567')).toBe(false)
  })

  it('rejects sms: (SMS draft)', () => {
    expect(isAllowedExternalUrl('sms:+15551234567')).toBe(false)
  })

  it('rejects itms-services: (iOS enterprise MDM install prompt)', () => {
    expect(
      isAllowedExternalUrl(
        'itms-services://?action=download-manifest&url=https://evil.example/m.plist'
      )
    ).toBe(false)
  })

  it('rejects intent: (Android Intent resolution)', () => {
    expect(isAllowedExternalUrl('intent://path#Intent;scheme=mal;package=com.evil;end')).toBe(false)
  })

  it('rejects javascript: (XSS vector if ever rendered to a webview)', () => {
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false)
  })

  it('rejects file: (local file access)', () => {
    expect(isAllowedExternalUrl('file:///etc/passwd')).toBe(false)
  })

  it('rejects data: (inline payload)', () => {
    expect(isAllowedExternalUrl('data:text/html,<script>1</script>')).toBe(false)
  })

  it('rejects custom-scheme deeplinks', () => {
    expect(isAllowedExternalUrl('canshift://signin?token=stolen')).toBe(false)
  })
})

describe('isAllowedExternalUrl — malformed input', () => {
  it('rejects empty string', () => {
    expect(isAllowedExternalUrl('')).toBe(false)
  })

  it('rejects non-string', () => {
    expect(isAllowedExternalUrl(null)).toBe(false)
    expect(isAllowedExternalUrl(undefined)).toBe(false)
    expect(isAllowedExternalUrl(42)).toBe(false)
    expect(isAllowedExternalUrl({ url: 'https://x.com' })).toBe(false)
  })

  it('rejects relative URLs (no scheme)', () => {
    expect(isAllowedExternalUrl('/path/only')).toBe(false)
    expect(isAllowedExternalUrl('path/only')).toBe(false)
  })

  it('rejects garbage strings', () => {
    expect(isAllowedExternalUrl('not a url')).toBe(false)
    // Note: `https:/missing-slash` parses to a valid URL under WHATWG rules
    // because http(s) are "special" schemes and the parser auto-fills the
    // missing slash. Tighter syntax checks belong at the schema layer, not
    // here — this guard only blocks scheme.
  })
})

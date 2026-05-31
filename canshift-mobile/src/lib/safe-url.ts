// safe-url.ts — Allowlist guard for external URL navigation.
//
// `Linking.openURL` hands the URL to the OS, which then resolves it against
// every registered scheme handler — `tel:` auto-dials, `sms:` drafts an SMS,
// `itms-services:` triggers an enterprise MDM install prompt, `intent://…`
// resolves to any installed handler on Android, custom-scheme deeplinks
// pivot the user into another app.
//
// Release notes are rendered Markdown; a maintainer with write access (or
// a future compromised release) can publish a link with any scheme. The
// asset rows on AboutScreen also pass through the same path. Guarding both
// at the call site keeps the threat surface to the explicit allowlist
// below.
//
// Scope: only HTTPS, HTTP, and mailto are permitted. HTTPS is the canonical
// path (GitHub release pages, docs, support links). HTTP is allowed as a
// concession to legacy hosts that haven't moved to TLS yet — the OS browser
// will show its own insecure-page warning if relevant. mailto is allowed
// because the About screen exposes a "report issue" link that pre-fills an
// email; any other scheme would have to be added here explicitly with a
// review.

const ALLOWED_SCHEMES = new Set(['https:', 'http:', 'mailto:'])

/**
 * Returns true when `url` is a syntactically valid absolute URL whose
 * scheme is on the allowlist. Returns false on any of:
 *   - empty / non-string input
 *   - relative URLs (no scheme)
 *   - URLs with a scheme not in {https, http, mailto}
 *   - URLs that fail `URL` parsing (malformed)
 *
 * The signature is intentionally `(unknown) => boolean` rather than a
 * `url is string` type predicate — the latter narrows the false branch
 * to `never` for any caller that already has a `string` type, which
 * breaks template literals like `Blocked: ${url}` in the rejection path.
 */
export function isAllowedExternalUrl(url: unknown): boolean {
  if (typeof url !== 'string' || url.length === 0) return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  return ALLOWED_SCHEMES.has(parsed.protocol)
}

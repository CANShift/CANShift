// security.service.ts — Renderer Content-Security-Policy + outbound URL guard
//
// Centralises main-process security primitives:
// - installContentSecurityPolicy(): strict CSP via webRequest headers (prod only)
// - isExternalUrlAllowed(): scheme allowlist for shell.openExternal targets

import { session } from 'electron'

// `connect-src` allowlist for outbound network calls. Production locks down
// to api.github.com (release manifests) + githubusercontent (firmware assets).
// Dev additionally allows http+ws on localhost so Vite HMR works without
// disabling CSP entirely — that gap previously let the dev build load any
// arbitrary HTTP resource (issue #913).
const PROD_CONNECT_SRC =
  "connect-src 'self' https://api.github.com https://objects.githubusercontent.com https://github.com"
const DEV_CONNECT_SRC = `${PROD_CONNECT_SRC} http://localhost:* ws://localhost:*`

function buildCsp(connectSrc: string): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    connectSrc,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'none'",
  ].join('; ')
}

const PROD_CSP = buildCsp(PROD_CONNECT_SRC)
const DEV_CSP = buildCsp(DEV_CONNECT_SRC)

export function installContentSecurityPolicy(): void {
  // Both dev and prod get a CSP — dev just whitelists localhost so HMR works.
  // The previous "skip in dev" branch meant a dev renderer could fetch any
  // HTTP URL, which would matter the moment user-typed URLs entered the
  // renderer (search box, paste-then-render, …). Issue #913.
  const csp = process.env.ELECTRON_RENDERER_URL !== undefined ? DEV_CSP : PROD_CSP

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    })
  })
}

/**
 * Returns true only when `url` is safe to hand to `shell.openExternal`.
 * Allowlist: `https:` always; `http:` only when running under Vite dev
 * (signalled by ELECTRON_RENDERER_URL — same convention as the CSP guard).
 * Anything else (`file:`, `javascript:`, custom protocols, malformed URLs)
 * is denied. Pass an explicit `isDev` for tests.
 */
export function isExternalUrlAllowed(
  url: string,
  isDev: boolean = process.env.ELECTRON_RENDERER_URL !== undefined
): boolean {
  try {
    const { protocol } = new URL(url)
    if (protocol === 'https:') return true
    if (protocol === 'http:' && isDev) return true
    return false
  } catch {
    return false
  }
}

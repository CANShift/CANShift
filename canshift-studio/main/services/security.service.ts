// security.service.ts — Renderer Content-Security-Policy + outbound URL guard
//
// Centralises main-process security primitives:
// - installContentSecurityPolicy(): strict CSP via webRequest headers (prod only)
// - isExternalUrlAllowed(): scheme allowlist for shell.openExternal targets

import { session } from 'electron'

const PROD_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.github.com https://objects.githubusercontent.com https://github.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'none'",
].join('; ')

export function installContentSecurityPolicy(): void {
  // Skip in dev — Vite HMR (ws://localhost) is incompatible with a strict prod CSP.
  if (process.env.ELECTRON_RENDERER_URL !== undefined) return

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [PROD_CSP],
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

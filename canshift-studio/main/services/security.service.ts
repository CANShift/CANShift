// security.ts — Renderer Content-Security-Policy header injection
//
// Installs a strict CSP via session.webRequest.onHeadersReceived. Skipped in
// dev because Vite HMR (ws://localhost) is incompatible with a strict prod CSP.

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

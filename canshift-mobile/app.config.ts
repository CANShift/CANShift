// app.config.ts — Dynamic Expo config (wraps app.json)
//
// Why this file exists:
//   The OTA HMAC shared secret (counterpart of `OTA_HMAC_SECRET` in firmware)
//   needs to be baked into the app at build time. `app.json` is static and
//   cannot read environment variables; `app.config.ts` can.
//
// Expo resolves config in this order:
//   1. app.config.ts (this file) — has highest priority
//   2. app.json — referenced via the `config` argument below
//
// Local dev: leave `OTA_HMAC_SECRET` unset and the app falls back to the
// `DEV_INSECURE_REPLACE_BEFORE_PROD` string baked into both firmware and
// mobile so unsigned-dev OTA works end-to-end. Production: set
// `OTA_HMAC_SECRET` via an EAS secret (see PR description).
//
// IMPORTANT: never log the secret or echo it from CI scripts. The value is
// passed straight from the env var into `extra.otaHmacSecret` and read at
// runtime by `src/services/ota-secret.ts`.

import type { ConfigContext, ExpoConfig } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => {
  // The base shape comes from app.json; we extend `extra` with
  // build-time-only injections.
  const otaHmacSecret = process.env.OTA_HMAC_SECRET ?? ''
  return {
    ...config,
    name: config.name ?? 'CANShift',
    slug: config.slug ?? 'canshift-mobile',
    extra: {
      ...config.extra,
      // Empty string here means "no override" — the runtime loader will fall
      // back to the dev secret. We never echo the value back through logs.
      otaHmacSecret,
    },
  }
}

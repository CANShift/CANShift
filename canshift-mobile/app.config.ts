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
import { Buffer } from 'buffer'

// HMAC-SHA256 keys are 256 bits = 32 bytes; anything shorter is a weakened
// key that the firmware will accept but a determined attacker can brute-force.
// Throwing at config time is loud — the build fails before EAS uploads a
// binary signed with a short secret (#1017 M-LO-4).
const MIN_OTA_HMAC_SECRET_BYTES = 32

export default ({ config }: ConfigContext): ExpoConfig => {
  // The base shape comes from app.json; we extend `extra` with
  // build-time-only injections.
  const rawSecret = process.env.OTA_HMAC_SECRET
  if (typeof rawSecret === 'string' && rawSecret.length > 0) {
    const byteLen = Buffer.byteLength(rawSecret, 'utf8')
    if (byteLen < MIN_OTA_HMAC_SECRET_BYTES) {
      // We deliberately do NOT echo the secret in the error message — the
      // length is enough signal for the operator and keeps the value out of
      // any captured CI / log surface.
      throw new Error(
        `OTA_HMAC_SECRET is set but only ${String(byteLen)} bytes — must be at least ${String(MIN_OTA_HMAC_SECRET_BYTES)} bytes (256-bit key for HMAC-SHA256). Refusing to build with a weak shared secret.`
      )
    }
  }
  // Empty string here means "no override" — the runtime loader will fall
  // back to the dev secret. We never echo the value back through logs.
  const otaHmacSecret = rawSecret ?? ''
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

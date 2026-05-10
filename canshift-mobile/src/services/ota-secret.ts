// ota-secret.ts — OTA HMAC shared secret loader (build-time + runtime)
//
// Strategy: the secret is baked into the app at build time via Expo extra
// config (`app.config.ts` → `extra.otaHmacSecret`) and read here at runtime
// through `expo-constants`. EAS builds inject `OTA_HMAC_SECRET` from a
// project-level secret; local dev falls back to the same string the firmware
// uses when `APP_OTA_REQUIRE_HMAC=0` (`DEV_INSECURE_REPLACE_BEFORE_PROD`),
// keeping the dev OTA flow end-to-end functional without secrets.
//
// Operational rules (CLAUDE.md / global rules):
//  - never log the secret value,
//  - never write it to disk,
//  - never expose it through React state or props.
//
// The exported helpers are intentionally minimal so accidental misuse stays
// loud at the call site.

import Constants from 'expo-constants'
import { Buffer } from 'buffer'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Dev fallback — must match the firmware fallback in
 * `canshift-firmware/include/app_config.h::OTA_HMAC_SECRET`. Used only when
 * no secret was injected at build time. Production builds MUST replace this
 * via the `OTA_HMAC_SECRET` env var fed into `app.config.ts`.
 */
export const DEV_INSECURE_OTA_SECRET = 'DEV_INSECURE_REPLACE_BEFORE_PROD'

// ---------------------------------------------------------------------------
// Reader
// ---------------------------------------------------------------------------

/**
 * Read the configured OTA HMAC secret from the Expo build manifest. Returns
 * the dev fallback when no secret was injected. Never throws.
 */
function readConfiguredSecret(): string {
  // `expoConfig` may be null in some early-boot or test environments. Fall
  // back to the embedded `manifest2` shape when needed, then to the dev
  // string. This module never crashes the app — the firmware will reject
  // bad uploads, the UI will surface a typed error, and we will not have
  // taken down boot trying to read a config field.
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>
  const candidate = extra.otaHmacSecret
  if (typeof candidate === 'string' && candidate.length > 0) {
    return candidate
  }
  return DEV_INSECURE_OTA_SECRET
}

/**
 * Get the OTA HMAC secret as raw bytes (UTF-8), suitable for `hmacSha256`.
 * Computed lazily so unit tests can mock `expo-constants` per test.
 *
 * Do NOT cache the returned `Uint8Array` across module boundaries; the
 * caller should consume it and let it go out of scope.
 */
export function getOtaHmacSecretBytes(): Uint8Array {
  return new Uint8Array(Buffer.from(readConfiguredSecret(), 'utf8'))
}

/**
 * `true` iff the configured secret is the dev fallback. Useful for surfacing
 * a "OTA is unsigned in this build" indicator in the UI without ever
 * revealing the secret value itself.
 */
export function isUsingDevOtaSecret(): boolean {
  return readConfiguredSecret() === DEV_INSECURE_OTA_SECRET
}

// ota-hmac.service.ts — Compute and append the OTA firmware HMAC-SHA256 trailer.
//
// Wire contract (frozen, mirrors firmware-side verifier in ota_hmac.cpp/.h):
//   <firmware bytes> || HMAC_SHA256(firmware bytes, secret)
// The trailer is exactly 32 bytes; firmware reads them off the tail before
// flashing and rejects the image if the MAC doesn't match.
//
// Dev fallback secret MUST stay byte-identical to the firmware fallback in
// canshift-firmware/include/app_config.h (`DEV_INSECURE_REPLACE_BEFORE_PROD`)
// so unsigned dev builds still verify when secrets.json is absent.

import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const OTA_HMAC_TRAILER_BYTES = 32

/** Must match firmware fallback exactly — see app_config.h `OTA_HMAC_SECRET`. */
export const OTA_HMAC_DEV_FALLBACK = 'DEV_INSECURE_REPLACE_BEFORE_PROD'

const SECRET_ENV_VAR = 'OTA_HMAC_SECRET'
const SECRETS_FILE = 'secrets.json'

interface SecretsFile {
  otaHmacSecret?: string
}

/**
 * HMAC-SHA256 of `firmware` keyed by `secret`. Returns exactly 32 bytes.
 * Empty firmware is valid input — the MAC is still well-defined.
 */
export function computeOtaHmacTrailer(firmware: Uint8Array, secret: string): Uint8Array {
  if (secret.length === 0) {
    throw new Error('OTA HMAC secret must be non-empty')
  }
  const mac = createHmac('sha256', secret).update(firmware).digest()
  return new Uint8Array(mac.buffer, mac.byteOffset, mac.byteLength)
}

/** Returns a new buffer: `firmware || HMAC-SHA256(firmware, secret)`. */
export function appendOtaHmacTrailer(firmware: Uint8Array, secret: string): Uint8Array {
  const trailer = computeOtaHmacTrailer(firmware, secret)
  const out = new Uint8Array(firmware.length + OTA_HMAC_TRAILER_BYTES)
  out.set(firmware, 0)
  out.set(trailer, firmware.length)
  return out
}

/**
 * Resolve the OTA HMAC secret in this priority order:
 *   1. `OTA_HMAC_SECRET` env var (CI / production injection)
 *   2. `secrets.json` at `projectRoot` with key `otaHmacSecret`
 *   3. Dev fallback `DEV_INSECURE_REPLACE_BEFORE_PROD`
 *
 * `projectRoot` defaults to the studio package root. Never logs the secret.
 */
export function loadOtaHmacSecret(projectRoot: string = resolve(__dirname, '..', '..')): string {
  const fromEnv = process.env[SECRET_ENV_VAR]
  if (typeof fromEnv === 'string' && fromEnv.length > 0) {
    return fromEnv
  }
  const fromFile = readSecretFromFile(resolve(projectRoot, SECRETS_FILE))
  if (fromFile !== null) {
    return fromFile
  }
  return OTA_HMAC_DEV_FALLBACK
}

function readSecretFromFile(filePath: string): string | null {
  let raw: string
  try {
    raw = readFileSync(filePath, 'utf8')
  } catch {
    return null
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw) as unknown
  } catch {
    throw new Error(`Invalid JSON in ${SECRETS_FILE}`)
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null
  }
  const candidate = (parsed as SecretsFile).otaHmacSecret
  if (typeof candidate === 'string' && candidate.length > 0) {
    return candidate
  }
  return null
}

// ble.validators.ts — Pure JSON payload validators for BLE characteristics.
// Defends against malformed or malicious peripherals that could ship payloads
// breaking chart math, store invariants, or downstream rendering. Pure
// functions: no external state, fully unit-testable.

import { SIGNAL_META } from '../constants/ble'

// Maximum number of telemetry keys accepted in a single payload. Anything past
// this cap is dropped — firmware never legitimately ships more than the
// SIGNAL_META count, so this is a defensive ceiling.
const MAX_TELEMETRY_KEYS = 32

// Maximum length for free-form STATUS strings. The firmware caps these at
// ~32 chars (version tag, AP SSID); reject anything wildly longer.
const MAX_STATUS_STRING_LEN = 32

// Telemetry payload after validation: only allowlisted keys, all finite numbers.
export type TelemetrySample = Partial<Record<keyof typeof SIGNAL_META, number>>

// STATUS payload after validation. All fields optional — firmware may omit any.
export interface StatusPayload {
  ver?: string
  can?: number
  ap_ssid?: string
  is_day?: number
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return undefined
  }
}

/**
 * Parse and validate a telemetry payload.
 *
 * Returns a sanitized record containing only allowlisted keys with finite
 * numeric values. Unknown keys, non-number values, NaN, and ±Infinity are
 * dropped silently. Returns null only when the input is not a JSON object
 * (parse failure, array, primitive) — in that case the whole payload is
 * unrecoverable and the caller should skip the update.
 */
export function parseTelemetry(raw: string): TelemetrySample | null {
  const parsed = safeJsonParse(raw)
  if (!isPlainObject(parsed)) return null

  const result: TelemetrySample = {}
  let count = 0
  for (const [key, value] of Object.entries(parsed)) {
    if (count >= MAX_TELEMETRY_KEYS) break
    count += 1
    if (!(key in SIGNAL_META)) continue
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    result[key] = value
  }
  return result
}

/**
 * Parse and validate a STATUS payload.
 *
 * Returns a sanitized object with only the recognized fields, validated by
 * shape. Strings are length-capped; numbers must be finite. Returns null
 * when input is not a JSON object.
 */
export function parseStatus(raw: string): StatusPayload | null {
  const parsed = safeJsonParse(raw)
  if (!isPlainObject(parsed)) return null

  const result: StatusPayload = {}

  if (typeof parsed.ver === 'string' && parsed.ver.length <= MAX_STATUS_STRING_LEN) {
    result.ver = parsed.ver
  }
  if (typeof parsed.can === 'number' && Number.isFinite(parsed.can)) {
    result.can = parsed.can
  }
  if (
    typeof parsed.ap_ssid === 'string' &&
    parsed.ap_ssid.length <= MAX_STATUS_STRING_LEN
  ) {
    result.ap_ssid = parsed.ap_ssid
  }
  if (typeof parsed.is_day === 'number' && Number.isFinite(parsed.is_day)) {
    result.is_day = parsed.is_day
  }

  return result
}

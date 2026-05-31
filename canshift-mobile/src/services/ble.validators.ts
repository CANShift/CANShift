// ble.validators.ts — Pure JSON payload validators for BLE characteristics.
//
// STATUS validation lives in `@tmbk/canshift-core/schemas/ble-status` since
// #887 — see `parseBleStatus` (camelCase domain shape + Zod-backed wire
// schema). This file now only owns the live telemetry validator, whose
// allowlist depends on the mobile-local `SIGNAL_META` table.

import { SIGNAL_META } from '../constants/ble'
import { log } from '../stores/log.store'

// Maximum number of telemetry keys accepted in a single payload. Anything past
// this cap is dropped — firmware never legitimately ships more than the
// SIGNAL_META count, so this is a defensive ceiling.
const MAX_TELEMETRY_KEYS = 32

// Telemetry payload after validation: only allowlisted keys, all finite numbers.
export type TelemetrySample = Partial<Record<keyof typeof SIGNAL_META, number>>

// Tracks unknown telemetry keys we've already warned about, so the log
// viewer doesn't get spammed at 10 Hz when a firmware build ships a
// signal the mobile build hasn't taught itself yet (#1017 M-LO-1).
//
// Lifetime: process — effectively the app session. The set is cleared by
// `_resetSessionState` for tests. A future LogScreen "clear" button could
// call it too, but that's a UX decision beyond this fix.
const warnedUnknownKeys = new Set<string>()

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
 * dropped silently — EXCEPT for the unknown-allowlist case, where the
 * first occurrence per key per session emits a warn into the app log
 * (#1017 M-LO-1) so a firmware/mobile signal-name drift is observable
 * instead of silent data loss.
 *
 * Returns null only when the input is not a JSON object (parse failure,
 * array, primitive) — in that case the whole payload is unrecoverable and
 * the caller should skip the update.
 */
export function parseTelemetry(raw: string): TelemetrySample | null {
  const parsed = safeJsonParse(raw)
  if (!isPlainObject(parsed)) return null

  const result: TelemetrySample = {}
  let count = 0
  for (const [key, value] of Object.entries(parsed)) {
    if (count >= MAX_TELEMETRY_KEYS) break
    count += 1
    if (!(key in SIGNAL_META)) {
      if (!warnedUnknownKeys.has(key)) {
        warnedUnknownKeys.add(key)
        log('warn', `BLE telemetry: unknown signal "${key}" (will not warn again this session)`)
      }
      continue
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    result[key] = value
  }
  return result
}

/**
 * Test-only: clear the module-level "already-warned" set so a fresh test
 * starts with no remembered keys. Production code does NOT call this —
 * unknown-key warnings are deliberately session-sticky to keep the log
 * viewer clean.
 */
export function _resetSessionState(): void {
  warnedUnknownKeys.clear()
}

// schemas/ble-status.ts — Zod schemas for the BLE STATUS characteristic.
//
// The firmware emits STATUS over GATT as JSON with snake_case keys
// (`ap_ssid`, `ap_password`, `is_day`) — that's the wire shape. Domain code
// reads the camelCase shape. The split mirrors `schemas/device.ts`
// (#715, #887) so the snake↔camel translation has exactly one source of
// truth.
//
// All fields are optional — firmware ships only what it has at the time
// (e.g. WiFi AP is absent until the OTA flow starts it). Numbers must be
// finite; strings are length-capped to defend against malformed peripherals
// flooding the receiver with multi-MB payloads.

import { z } from 'zod'

/** Max length for free-form STATUS strings. Firmware caps at ~32; we cap higher. */
export const BLE_STATUS_MAX_STRING_LEN = 32

const FiniteNumberSchema = z.number().refine(Number.isFinite, {
  message: 'must be a finite number',
})

const CappedStringSchema = z.string().max(BLE_STATUS_MAX_STRING_LEN)

/**
 * Wire format — exactly what the firmware sends. snake_case keys, all
 * optional. Strict: extra fields are rejected so a malicious peripheral
 * can't smuggle unknown keys into the receiver.
 */
export const BleStatusWireSchema = z
  .object({
    ver: CappedStringSchema.optional(),
    can: FiniteNumberSchema.optional(),
    ap_ssid: CappedStringSchema.optional(),
    ap_password: CappedStringSchema.optional(),
    is_day: FiniteNumberSchema.optional(),
  })
  .strict()

export type BleStatusWire = z.infer<typeof BleStatusWireSchema>

/**
 * Domain shape — camelCase, used by every TS consumer. Field optionality
 * mirrors the wire shape one-to-one.
 */
export interface BleStatus {
  firmwareVersion?: string
  canHealthy?: boolean
  apSsid?: string
  apPassword?: string
  isDay?: boolean
}

/**
 * Wire → domain. Pure; assumes input already passed `BleStatusWireSchema`.
 * Numeric `can` and `is_day` are 0/1 flags on the wire — translated to
 * `boolean` on the domain side. Any non-zero value is treated as true so
 * older firmware that ships 2/3/etc. for `can` health still narrows
 * predictably.
 */
export function bleStatusFromWire(wire: BleStatusWire): BleStatus {
  const out: BleStatus = {}
  if (wire.ver !== undefined) out.firmwareVersion = wire.ver
  if (wire.can !== undefined) out.canHealthy = wire.can !== 0
  if (wire.ap_ssid !== undefined) out.apSsid = wire.ap_ssid
  if (wire.ap_password !== undefined) out.apPassword = wire.ap_password
  if (wire.is_day !== undefined) out.isDay = wire.is_day !== 0
  return out
}

/**
 * Discriminated outcome of parsing a raw STATUS payload. Previously the
 * function collapsed three failure cases into `null` which made it
 * impossible for callers to surface a specific diagnostic. Audit finding
 * C-HI-3 (umbrella issue #1016) — mirrors the `LatestReleaseResult`
 * pattern from `types/releases.ts`. Discriminator is `kind` because each
 * variant carries different payload shapes and the consumer narrows on it.
 */
export type BleStatusResult =
  | { kind: 'ok'; status: BleStatus }
  /** `JSON.parse` threw — raw text preserved for the log line. */
  | { kind: 'invalid_json'; raw: string }
  /** Parsed JSON was a primitive or array — schema can't even run on it. */
  | { kind: 'not_an_object'; payload: unknown }
  /** Parsed JSON was an object but failed strict schema validation. */
  | { kind: 'wrong_shape'; issues: z.ZodIssue[] }

/**
 * Parse + validate a raw STATUS JSON string straight from the BLE
 * notification. Returns a discriminated `BleStatusResult` so callers can
 * distinguish malformed JSON, non-object payloads, and schema rejections
 * (each warrants a different log line). Callers should still skip the
 * device update on anything other than `kind === 'ok'`.
 */
export function parseBleStatus(raw: string): BleStatusResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { kind: 'invalid_json', raw }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { kind: 'not_an_object', payload: parsed }
  }
  const result = BleStatusWireSchema.safeParse(parsed)
  if (!result.success) {
    return { kind: 'wrong_shape', issues: result.error.issues }
  }
  return { kind: 'ok', status: bleStatusFromWire(result.data) }
}

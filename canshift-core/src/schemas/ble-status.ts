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

import { mapObjectKeys } from '../wire/keymap.js'

// snake→camel rename map shared with `bleStatusFromWire`. Only the
// string-shaped fields run through the helper; the numeric 0/1 ↔ boolean
// fields stay explicit because `mapObjectKeys` is a pure rename (audit
// follow-up to #1207).
const STATUS_STRING_WIRE_TO_DOMAIN = {
  ver: 'firmwareVersion',
  ap_ssid: 'apSsid',
  ap_password: 'apPassword',
} as const

/** Max length for free-form STATUS strings. Firmware caps at ~32; we cap higher. */
export const BLE_STATUS_MAX_STRING_LEN = 32

const CappedStringSchema = z.string().max(BLE_STATUS_MAX_STRING_LEN)

/**
 * Wire contract for STATUS boolean flags. Firmware emits these as raw 0/1
 * integers; any other value (0.5, 2, NaN, negative numbers) is a contract
 * violation. Previously typed as `FiniteNumber` which silently accepted
 * arbitrary floats — `can: 0.5` would map to `canHealthy: true` via the
 * `!== 0` predicate in `bleStatusFromWire`. Audit follow-up to #1289.
 */
const ZeroOrOneSchema = z.union([z.literal(0), z.literal(1)])

/**
 * Wire format — exactly what the firmware sends. snake_case keys, all
 * optional. Strict: extra fields are rejected so a malicious peripheral
 * can't smuggle unknown keys into the receiver.
 */
export const BleStatusWireSchema = z
  .object({
    ver: CappedStringSchema.optional(),
    can: ZeroOrOneSchema.optional(),
    ap_ssid: CappedStringSchema.optional(),
    ap_password: CappedStringSchema.optional(),
    is_day: ZeroOrOneSchema.optional(),
  })
  .strict()

export type BleStatusWire = z.infer<typeof BleStatusWireSchema>

/**
 * Domain shape — camelCase, used by every TS consumer. Field optionality
 * mirrors the wire shape one-to-one. Built as a Zod schema so the
 * discriminated `BleStatusResult` below can reuse it as a variant payload
 * without falling back to `z.custom` (audit follow-up to #1207).
 */
export const BleStatusSchema = z
  .object({
    firmwareVersion: z.string().optional(),
    canHealthy: z.boolean().optional(),
    apSsid: z.string().optional(),
    apPassword: z.string().optional(),
    isDay: z.boolean().optional(),
  })
  .strict()

export type BleStatus = z.infer<typeof BleStatusSchema>

/**
 * Wire → domain. Pure; assumes input already passed `BleStatusWireSchema`.
 * Numeric `can` and `is_day` are strict 0/1 flags on the wire — translated to
 * `boolean` on the domain side.
 */
export function bleStatusFromWire(wire: BleStatusWire): BleStatus {
  const { can, is_day, ...stringFields } = wire
  const out = mapObjectKeys(stringFields, STATUS_STRING_WIRE_TO_DOMAIN) as BleStatus
  if (can !== undefined) out.canHealthy = can !== 0
  if (is_day !== undefined) out.isDay = is_day !== 0
  return out
}

/**
 * Discriminated outcome of parsing a raw STATUS payload. Previously the
 * function collapsed three failure cases into `null` which made it
 * impossible for callers to surface a specific diagnostic. Audit finding
 * C-HI-3 (umbrella issue #1016) — mirrors the `LatestReleaseResult`
 * pattern from `types/releases.ts`.
 *
 * Built as a `z.discriminatedUnion` so the runtime schema is the single
 * source of truth and the type is derived via `z.infer`, matching the
 * `ButtonAction` / `WidgetConfig` / `TopBarItem` convention elsewhere in
 * this package (audit follow-up to #1207). Discriminator stays `kind` so
 * existing callers (mobile BLE service, tests) don't need to migrate.
 */
export const BleStatusResultSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ok'), status: BleStatusSchema }).strict(),
  /** `JSON.parse` threw — raw text preserved for the log line. */
  z.object({ kind: z.literal('invalid_json'), raw: z.string() }).strict(),
  /** Parsed JSON was a primitive or array — schema can't even run on it. */
  z.object({ kind: z.literal('not_an_object'), payload: z.unknown() }).strict(),
  /** Parsed JSON was an object but failed strict schema validation. ZodIssue
   *  is a third-party union (no Zod schema exported by the library), so the
   *  array element falls back to `z.custom` — runtime validation here is
   *  pointless because the result is constructed in `parseBleStatus`. */
  z
    .object({
      kind: z.literal('wrong_shape'),
      issues: z.array(z.custom<z.ZodIssue>()),
    })
    .strict(),
])

export type BleStatusResult = z.infer<typeof BleStatusResultSchema>

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

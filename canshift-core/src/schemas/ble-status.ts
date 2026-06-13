import { z } from 'zod'

export const BLE_STATUS_MAX_STRING_LEN = 32

const CappedStringSchema = z.string().max(BLE_STATUS_MAX_STRING_LEN)

const ZeroOrOneSchema = z.union([z.literal(0), z.literal(1)])

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

export interface BleStatus {
  firmwareVersion?: string
  canHealthy?: boolean
  apSsid?: string
  apPassword?: string
  isDay?: boolean
}

export const bleStatusFromWire = (wire: BleStatusWire): BleStatus => {
  const out: BleStatus = {}
  if (wire.ver !== undefined) out.firmwareVersion = wire.ver
  if (wire.can !== undefined) out.canHealthy = wire.can !== 0
  if (wire.ap_ssid !== undefined) out.apSsid = wire.ap_ssid
  if (wire.ap_password !== undefined) out.apPassword = wire.ap_password
  if (wire.is_day !== undefined) out.isDay = wire.is_day !== 0
  return out
}

export type BleStatusResult =
  | { kind: 'ok'; status: BleStatus }
  | { kind: 'invalid_json'; raw: string }
  | { kind: 'not_an_object'; payload: unknown }
  | { kind: 'wrong_shape'; issues: z.ZodIssue[] }

export const parseBleStatus = (raw: string): BleStatusResult => {
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

import { SIGNAL_META, type SignalKey } from '../constants/ble'
import { log } from '../stores/log.store'

const MAX_TELEMETRY_KEYS = 32

export type TelemetrySample = Partial<Record<SignalKey, number>>

const warnedUnknownKeys = new Set<string>()

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const safeJsonParse = (raw: string): unknown => {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return undefined
  }
}

export const parseTelemetry = (raw: string): TelemetrySample | null => {
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
    result[key as SignalKey] = value
  }
  return result
}

export const _resetSessionState = (): void => {
  warnedUnknownKeys.clear()
}

import { SENSOR_DEFAULT_RAMPS, colorAtValue, type SensorKind } from '@tmbk/canshift-core'
import type { SignalKey } from '../constants/ble'

const KEY_TO_SENSOR_KIND: Record<string, SensorKind> = {
  r: 'rpm',
  ct: 'coolant_temp',
  ot: 'oil_temp',
  op: 'oil_press',
  iat: 'intake_temp',
  bst: 'boost',
  lam: 'afr',
} satisfies Partial<Record<SignalKey, SensorKind>>

const FALLBACK_COLOR: Record<string, string> = {
  tps: '#FFD700',
  map: '#44AAFF',
  fp: '#FF88BB',
  s: '#CCCCCC',
  g: '#888888',
  bat: '#AAFFAA',
}

const DEFAULT_COLOR = '#888888'

export const getSignalColor = (key: string): string => {
  const kind = KEY_TO_SENSOR_KIND[key]
  if (kind) {
    const ramp = SENSOR_DEFAULT_RAMPS[kind]
    const first = ramp.stops[0]
    const last = ramp.stops[ramp.stops.length - 1]
    if (first && last) {
      return colorAtValue(ramp, (first.value + last.value) / 2)
    }
  }
  return FALLBACK_COLOR[key] ?? DEFAULT_COLOR
}

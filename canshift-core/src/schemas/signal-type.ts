import { z } from 'zod'

export const SIGNAL_TYPES = [
  'rpm',
  'speed',
  'throttle',
  'coolant',
  'oil_temp',
  'oil_pressure',
  'boost',
  'turbo',
  'battery',
  'fuel',
  'afr',
  'iat',
  'exhaust',
  'generic',
] as const

export const SignalTypeSchema = z.enum(SIGNAL_TYPES)

export type SignalType = z.infer<typeof SignalTypeSchema>

export const DEFAULT_SIGNAL_TYPE: SignalType = 'generic'

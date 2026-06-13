import { z } from 'zod'

export const SensorIconNameSchema = z.enum([
  'rpm',
  'speed',
  'coolant',
  'oil_pressure',
  'oil_temp',
  'battery',
  'fuel',
  'afr',
  'boost',
  'throttle',
  'iat',
  'gear',
  'timer',
  'warning',
  'flame',
  'turbo',
  'engine',
  'brake',
  'launch',
  'traction',
  'map_icon',
  'exhaust',
  'cog',
])

export type SensorIconName = z.infer<typeof SensorIconNameSchema>

import { z } from 'zod'

const BRIGHTNESS_MIN_PCT = 10
const BRIGHTNESS_MAX_PCT = 100

const SLEEP_MIN_S = 0
const SLEEP_MAX_S = 3600

const ALLOWED_ROTATIONS = [0, 180] as const

const BrightnessSchema = z
  .number()
  .int('brightness must be a whole percent')
  .min(BRIGHTNESS_MIN_PCT, `brightness cannot be below ${String(BRIGHTNESS_MIN_PCT)}%`)
  .max(BRIGHTNESS_MAX_PCT, `brightness cannot exceed ${String(BRIGHTNESS_MAX_PCT)}%`)

const SleepSchema = z
  .number()
  .int('sleep timeout must be a whole number of seconds')
  .min(SLEEP_MIN_S, `sleep cannot be below ${String(SLEEP_MIN_S)} s`)
  .max(SLEEP_MAX_S, `sleep cannot exceed ${String(SLEEP_MAX_S)} s (1 h)`)

const RotationSchema = z.union([z.literal(0), z.literal(180)])

export const ScreenSettingsSchema = z
  .object({
    brightness: BrightnessSchema,
    sleep: SleepSchema,
    rotation: RotationSchema.optional(),
  })
  .strict()

export type ScreenSettings = z.infer<typeof ScreenSettingsSchema>

export const SCREEN_SETTINGS_BOUNDS = {
  brightnessMinPct: BRIGHTNESS_MIN_PCT,
  brightnessMaxPct: BRIGHTNESS_MAX_PCT,
  sleepMinSeconds: SLEEP_MIN_S,
  sleepMaxSeconds: SLEEP_MAX_S,
  allowedRotations: ALLOWED_ROTATIONS,
} as const

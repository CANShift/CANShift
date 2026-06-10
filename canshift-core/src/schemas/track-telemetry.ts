import { z } from 'zod'

const LAP_MAX_MS = 60 * 60 * 1000

const LAP_NUMBER_MAX = 9999

const DELTA_ABS_MAX_MS = 60 * 60 * 1000

const LapTimeMsSchema = z
  .number()
  .int('lap times must be whole milliseconds')
  .nonnegative('lap times cannot be negative')
  .max(LAP_MAX_MS, `lap times cannot exceed ${String(LAP_MAX_MS)} ms (1 h)`)

const LapNumberSchema = z
  .number()
  .int()
  .min(0)
  .max(LAP_NUMBER_MAX, `lap number cannot exceed ${String(LAP_NUMBER_MAX)}`)

const DeltaMsSchema = z
  .number()
  .int('delta must be whole milliseconds')
  .min(-DELTA_ABS_MAX_MS, `delta cannot be below ${String(-DELTA_ABS_MAX_MS)} ms`)
  .max(DELTA_ABS_MAX_MS, `delta cannot exceed ${String(DELTA_ABS_MAX_MS)} ms`)

export const TrackTelemetrySchema = z
  .object({
    trackMode: z.boolean(),
    currentLapMs: LapTimeMsSchema.optional(),
    lastLapMs: LapTimeMsSchema.optional(),
    bestLapMs: LapTimeMsSchema.optional(),
    lapNumber: LapNumberSchema.optional(),
    deltaMs: DeltaMsSchema.optional(),
    isBestLap: z.boolean().optional(),
  })
  .strict()

export type TrackTelemetry = z.infer<typeof TrackTelemetrySchema>

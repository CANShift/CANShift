// schemas/signal.ts — Zod schemas for the signal catalog.
//
// Mirrors `types/signal.ts` field-for-field. `SignalConfig`, `SignalDef`,
// `ColorRamp`, `ColorRampStop`, and `RampInterpolation` are now derived from
// these schemas via `z.infer`.

import { z } from 'zod'

import { HexColorSchema, SemVerSchema } from './common.js'

/** Single stop on a color ramp — value in the signal's native unit, color in #RRGGBB. */
export const ColorRampStopSchema = z.object({
  value: z.number(),
  color: HexColorSchema,
})

/**
 * How a `ColorRamp` blends between adjacent stops.
 *  - `linear` — channel-wise lerp between the two surrounding stops.
 *  - `step`   — the lower stop's color is used for the entire segment.
 */
export const RampInterpolationSchema = z.enum(['linear', 'step'])

/**
 * Per-signal value→color mapping. Stops should be sorted ascending by `value`
 * and contain between 2 and `MAX_RAMP_STOPS` entries (enforced by hand-rolled
 * validator for the time being).
 */
export const ColorRampSchema = z.object({
  stops: z.array(ColorRampStopSchema),
  interpolate: RampInterpolationSchema,
})

/** Individual CAN signal definition. */
export const SignalDefSchema = z.object({
  name: z.string(),
  canFrameId: z.string(),
  startByte: z.number(),
  byteLength: z.union([z.literal(1), z.literal(2), z.literal(4)]),
  bigEndian: z.boolean(),
  signed: z.boolean(),
  bitMask: z.string().optional(),
  scale: z.number(),
  offset: z.number(),
  unit: z.string(),
  min: z.number(),
  max: z.number(),
  warningLevel: z.number().optional(),
  dangerLevel: z.number().optional(),
  highWarningLevel: z.number().optional(),
  highDangerLevel: z.number().optional(),
  timeoutMs: z.number(),
  colorRamp: ColorRampSchema.optional(),
})

/**
 * Root signal configuration (signals.json). `protocol` is informational only —
 * never used in parsing decisions. Current default is `"custom_v1.0"`.
 */
export const SignalConfigSchema = z.object({
  version: SemVerSchema,
  protocol: z.string(),
  canSpeedKbps: z.number(),
  signals: z.array(SignalDefSchema),
})

export type ColorRampStop = z.infer<typeof ColorRampStopSchema>
export type RampInterpolation = z.infer<typeof RampInterpolationSchema>
export type ColorRamp = z.infer<typeof ColorRampSchema>
export type SignalDef = z.infer<typeof SignalDefSchema>
export type SignalConfig = z.infer<typeof SignalConfigSchema>

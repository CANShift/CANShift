// schemas/common.ts — Zod schemas for shared primitive types.
//
// Mirrors `types/common.ts` field-for-field. Types in that file are now derived
// here via `z.infer` so the runtime schema is the single source of truth.

import { z } from 'zod'

import { HEX_COLOR_REGEX } from '../constants/firmware-caps.js'

/** Hex color string — e.g. "#FF4444" (6-digit, with leading `#`). */
export const HexColorSchema = z
  .string()
  .regex(HEX_COLOR_REGEX, 'must be a 6-digit hex color (e.g. "#FF4444")') as z.ZodType<`#${string}`>

/** Widget type discriminant. */
export const WidgetTypeSchema = z.enum([
  'gauge',
  'warning',
  'button',
  'timer',
  'bar',
  'gear',
  'image',
])

/** Widget position and size in pixels on a 320×240 canvas. */
export const WidgetLayoutSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    zOrder: z.number(),
  })
  .strict()

/** Widget visual style. */
export const WidgetStyleSchema = z
  .object({
    primaryColor: HexColorSchema,
    secondaryColor: HexColorSchema,
    warningColor: HexColorSchema,
    criticalColor: HexColorSchema,
    textColor: HexColorSchema,
    fontSize: z.number(),
    /** Optional border color — omit or set to null for no border */
    borderColor: HexColorSchema.nullable().optional(),
  })
  .strict()

/** Semantic version string — "MAJOR.MINOR.PATCH". */
export const SemVerSchema = z
  .string()
  .regex(
    /^\d+\.\d+\.\d+$/,
    'must be a semver string "MAJOR.MINOR.PATCH"'
  ) as z.ZodType<`${number}.${number}.${number}`>

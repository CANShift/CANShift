// schemas/common.ts — Zod schemas for shared primitive types.
//
// Mirrors `types/common.ts` field-for-field. Types in that file are now derived
// here via `z.infer` so the runtime schema is the single source of truth.

import { z } from 'zod'

import { CANVAS, HEX_COLOR_REGEX } from '../constants/firmware-caps.js'

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

/**
 * Widget position and size in pixels on the 320×240 canvas.
 *
 * Bounds enforced so the firmware can render the widget without clipping or
 * memory corruption — see CANVAS in firmware-caps.ts. Cross-field refines
 * block `x+w > CANVAS.WIDTH` and `y+h > CANVAS.HEIGHT` which would silently
 * push the widget partially off-screen on device.
 */
export const WidgetLayoutSchema = z
  .object({
    x: z
      .number()
      .int()
      .min(0)
      .max(CANVAS.WIDTH - 1),
    y: z
      .number()
      .int()
      .min(0)
      .max(CANVAS.HEIGHT - 1),
    w: z.number().int().min(1).max(CANVAS.WIDTH),
    h: z.number().int().min(1).max(CANVAS.HEIGHT),
    zOrder: z.number(),
  })
  .strict()
  .refine((l) => l.x + l.w <= CANVAS.WIDTH, {
    message: `layout: x+w must be <= ${String(CANVAS.WIDTH)}`,
    path: ['w'],
  })
  .refine((l) => l.y + l.h <= CANVAS.HEIGHT, {
    message: `layout: y+h must be <= ${String(CANVAS.HEIGHT)}`,
    path: ['h'],
  })

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
    /**
     * When false, the widget keeps its `textColor` regardless of day/night
     * mode. Default behaviour (omitted / true) follows the active theme,
     * matching the v0.7.0 contract (#171). Issue #191.
     */
    respectDayMode: z.boolean().optional(),
  })
  .strict()

/** Semantic version string — "MAJOR.MINOR.PATCH". */
export const SemVerSchema = z
  .string()
  .regex(
    /^\d+\.\d+\.\d+$/,
    'must be a semver string "MAJOR.MINOR.PATCH"'
  ) as z.ZodType<`${number}.${number}.${number}`>

/** Hex color string — e.g. "#FF4444". */
export type HexColor = z.infer<typeof HexColorSchema>

/** Widget type discriminant. */
export type WidgetType = z.infer<typeof WidgetTypeSchema>

/** Widget position and size in pixels on a 320×240 canvas. */
export type WidgetLayout = z.infer<typeof WidgetLayoutSchema>

/** Widget visual style. */
export type WidgetStyle = z.infer<typeof WidgetStyleSchema>

/** Semantic version string — "MAJOR.MINOR.PATCH". */
export type SemVer = z.infer<typeof SemVerSchema>

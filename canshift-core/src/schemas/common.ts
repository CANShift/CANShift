// schemas/common.ts — Zod schemas for shared primitive types.
//
// Mirrors `types/common.ts` field-for-field. Types in that file are now derived
// here via `z.infer` so the runtime schema is the single source of truth.

import { z } from 'zod'

import { HEX_REGEX } from '../colors/hex.js'
import { CANVAS } from '../constants/firmware-caps.js'

/**
 * Hex color string — e.g. "#FF4444" (6-digit, with leading `#`).
 *
 * Uses `z.custom` rather than `z.string().regex(...) as z.ZodType<...>` so the
 * template-literal type is enforced by a real runtime check instead of an
 * unchecked `as` cast (audit C-ME-1, umbrella #1016).
 */
export const HexColorSchema = z.custom<`#${string}`>(
  (v) => typeof v === 'string' && HEX_REGEX.test(v),
  { message: 'must be a 6-digit hex color (e.g. "#FF4444")' }
)

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

/**
 * Semantic version string — "MAJOR.MINOR.PATCH".
 *
 * `z.custom` enforces the template-literal type at runtime instead of via an
 * unchecked `as` cast (audit C-ME-1, umbrella #1016).
 */
const SEMVER_REGEX = /^\d+\.\d+\.\d+$/
export const SemVerSchema = z.custom<`${number}.${number}.${number}`>(
  (v) => typeof v === 'string' && SEMVER_REGEX.test(v),
  { message: 'must be a semver string "MAJOR.MINOR.PATCH"' }
)

/** Hex color string — e.g. "#FF4444". */
export type HexColor = z.infer<typeof HexColorSchema>

/** Widget position and size in pixels on a 320×240 canvas. */
export type WidgetLayout = z.infer<typeof WidgetLayoutSchema>

/** Widget visual style. */
export type WidgetStyle = z.infer<typeof WidgetStyleSchema>

/** Semantic version string — "MAJOR.MINOR.PATCH". */
export type SemVer = z.infer<typeof SemVerSchema>

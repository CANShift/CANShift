// schemas/common.ts — Zod schemas for shared primitive types.
//
// Mirrors `types/common.ts` field-for-field. Types in that file are now derived
// here via `z.infer` so the runtime schema is the single source of truth.

import { z } from 'zod'

import { HEX_REGEX } from '../colors/hex.js'
import { CANVAS, FONT_SIZE_MAX, FONT_SIZE_MIN } from '../constants/firmware-caps.js'

/**
 * Hex color string — e.g. "#FF4444" (6-digit, with leading `#`).
 *
 * `.brand<'HexColor'>()` gives nominal typing: a plain `string` is no longer
 * implicitly assignable to a `HexColor` (issue #1207 audit follow-up to #1316).
 * Call sites that author literal hex colours go through `HexColorSchema.parse`
 * once at module load — runtime-validated, statically typed.
 */
export const HexColorSchema = z
  .string()
  .regex(HEX_REGEX, { message: 'must be a 6-digit hex color (e.g. "#FF4444")' })
  .brand<'HexColor'>()

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
    zOrder: z.number().int(),
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
    fontSize: z.number().int().min(FONT_SIZE_MIN).max(FONT_SIZE_MAX),
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
 * `.brand<'SemVer'>()` gives nominal typing: plain `string` is no longer
 * assignable to a `SemVer`. Literal versions used as constants (e.g. the
 * migration chain's `'1.22.0'` writes and `CURRENT_SCHEMA_VERSION`) flow
 * through `SemVerSchema.parse` once at module load.
 */
const SEMVER_REGEX = /^\d+\.\d+\.\d+$/
export const SemVerSchema = z
  .string()
  .regex(SEMVER_REGEX, { message: 'must be a semver string "MAJOR.MINOR.PATCH"' })
  .brand<'SemVer'>()

/** Hex color string — e.g. "#FF4444". */
export type HexColor = z.infer<typeof HexColorSchema>

/** Widget position and size in pixels on a 320×240 canvas. */
export type WidgetLayout = z.infer<typeof WidgetLayoutSchema>

/** Widget visual style. */
export type WidgetStyle = z.infer<typeof WidgetStyleSchema>

/** Semantic version string — "MAJOR.MINOR.PATCH". */
export type SemVer = z.infer<typeof SemVerSchema>

import { z } from 'zod'

import { HEX_REGEX } from '../colors/hex.js'
import { CANVAS, FONT_SIZE_MAX, FONT_SIZE_MIN } from '../constants/firmware-caps.js'
import { SEMVER_PATTERN } from '../migrations/semver.js'

export const HexColorSchema = z
  .string()
  .regex(HEX_REGEX, { message: 'must be a 6-digit hex color (e.g. "#FF4444")' })
  .brand<'HexColor'>()

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

export const WidgetStyleSchema = z
  .object({
    primaryColor: HexColorSchema,
    secondaryColor: HexColorSchema,
    warningColor: HexColorSchema,
    criticalColor: HexColorSchema,
    textColor: HexColorSchema,
    fontSize: z.number().int().min(FONT_SIZE_MIN).max(FONT_SIZE_MAX),
    borderColor: HexColorSchema.nullable().optional(),
    respectDayMode: z.boolean().optional(),
  })
  .strict()

export const SemVerSchema = z
  .string()
  .regex(SEMVER_PATTERN, { message: 'must be a semver string "MAJOR.MINOR.PATCH"' })
  .brand<'SemVer'>()

export type HexColor = z.infer<typeof HexColorSchema>

export type WidgetLayout = z.infer<typeof WidgetLayoutSchema>

export type WidgetStyle = z.infer<typeof WidgetStyleSchema>

export type SemVer = z.infer<typeof SemVerSchema>

import { z } from 'zod'

import { HEX_REGEX } from '../colors/hex.js'
import { FONT_SIZE_MAX, FONT_SIZE_MIN } from '../constants/firmware-caps.js'
import { SEMVER_PATTERN } from '../constants/validation.js'
import { LAYOUT_GRID } from '../layout-grid.js'

export const HexColorSchema = z
  .string()
  .regex(HEX_REGEX, { message: 'must be a 6-digit hex color (e.g. "#FF4444")' })
  .brand<'HexColor'>()

export const WidgetLayoutSchema = z
  .object({
    col: z
      .number()
      .int()
      .min(0)
      .max(LAYOUT_GRID.COLUMNS - 1),
    colSpan: z.number().int().min(1).max(LAYOUT_GRID.COLUMNS),
    row: z
      .number()
      .int()
      .min(0)
      .max(LAYOUT_GRID.ROWS - 1),
    rowSpan: z.number().int().min(1).max(LAYOUT_GRID.ROWS),
    zOrder: z.number().int(),
  })
  .strict()
  .refine((l) => l.col + l.colSpan <= LAYOUT_GRID.COLUMNS, {
    message: `layout: col+colSpan must be <= ${String(LAYOUT_GRID.COLUMNS)}`,
    path: ['colSpan'],
  })
  .refine((l) => l.row + l.rowSpan <= LAYOUT_GRID.ROWS, {
    message: `layout: row+rowSpan must be <= ${String(LAYOUT_GRID.ROWS)}`,
    path: ['rowSpan'],
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

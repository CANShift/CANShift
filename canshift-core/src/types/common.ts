// common.ts — Shared primitive types used across all config entities.
//
// All declarations are derived from the Zod schemas in `schemas/common.ts`
// via `z.infer`, mirroring the pattern in `types/dashboard.ts` and
// `types/signal.ts`. The schema is the single source of truth (#770).

import type { z } from 'zod'
import type {
  HexColorSchema,
  SemVerSchema,
  WidgetLayoutSchema,
  WidgetStyleSchema,
  WidgetTypeSchema,
} from '../schemas/common.js'

/** Hex color string — e.g. "#FF4444" */
export type HexColor = z.infer<typeof HexColorSchema>

/** Widget type discriminant */
export type WidgetType = z.infer<typeof WidgetTypeSchema>

/** Widget position and size in pixels on a 320×240 canvas */
export type WidgetLayout = z.infer<typeof WidgetLayoutSchema>

/** Widget visual style */
export type WidgetStyle = z.infer<typeof WidgetStyleSchema>

/** Semantic version string — "MAJOR.MINOR.PATCH" */
export type SemVer = z.infer<typeof SemVerSchema>

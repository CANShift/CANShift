import { z } from 'zod'

export const SHIFT_LIGHT_SEGMENT_COUNT = 12

export const ShiftLightWidgetConfigSchema = z
  .object({
    type: z.literal('shift_light'),
    startValue: z.number().nonnegative(),
    redSegments: z.number().int().min(0).max(SHIFT_LIGHT_SEGMENT_COUNT),
  })
  .strict()

export type ShiftLightWidgetConfig = z.infer<typeof ShiftLightWidgetConfigSchema>

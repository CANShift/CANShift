import { z } from 'zod'

import { SensorIconNameSchema } from './sensor-icon.js'

export const WarningWidgetConfigSchema = z
  .object({
    type: z.literal('warning'),
    invertLogic: z.boolean().optional(),
    threshold: z.number(),
    iconName: SensorIconNameSchema.optional(),
  })
  .strict()

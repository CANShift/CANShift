import { z } from 'zod'

export const TimerWidgetConfigSchema = z
  .object({
    type: z.literal('timer'),
    autoStart: z.boolean().optional(),
    format: z.enum(['mm:ss', 'ss.mmm']).optional(),
  })
  .strict()

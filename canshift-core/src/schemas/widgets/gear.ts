import { z } from 'zod'

import { STRING_CAPS } from '../../constants/firmware-caps.js'

export const GearWidgetConfigSchema = z
  .object({
    type: z.literal('gear'),
    decimalPlaces: z.literal(0),
    prefix: z.string().max(STRING_CAPS.WIDGET_PREFIX_SUFFIX).optional(),
    suffix: z.string().max(STRING_CAPS.WIDGET_PREFIX_SUFFIX).optional(),
  })
  .strict()

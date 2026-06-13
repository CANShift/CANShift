import { z } from 'zod'

import { DECIMAL_PLACES, STRING_CAPS } from '../../constants/firmware-caps.js'

import { SensorIconNameSchema } from './sensor-icon.js'

export const GaugeDisplayStyleSchema = z.enum(['numeric', 'arc'])
export const GaugeArcFillStyleSchema = z.enum(['zones', 'gradient'])

export const GaugeWidgetConfigSchema = z
  .object({
    type: z.literal('gauge'),
    displayStyle: GaugeDisplayStyleSchema,
    minValue: z.number(),
    maxValue: z.number(),
    dangerLevel: z.number(),
    decimalPlaces: z.number().int().min(DECIMAL_PLACES.MIN).max(DECIMAL_PLACES.MAX),
    prefix: z.string().max(STRING_CAPS.WIDGET_PREFIX_SUFFIX).optional(),
    suffix: z.string().max(STRING_CAPS.WIDGET_PREFIX_SUFFIX).optional(),
    showNeedle: z.boolean().optional(),
    arcFillStyle: GaugeArcFillStyleSchema.optional(),
    revFlash: z.boolean().optional(),
    alertThreshold: z.number().optional(),
    iconName: SensorIconNameSchema.optional(),
  })
  .strict()

export type GaugeDisplayStyle = z.infer<typeof GaugeDisplayStyleSchema>
export type GaugeArcFillStyle = z.infer<typeof GaugeArcFillStyleSchema>

import { z } from 'zod'

import { FIRMWARE_CAPS, STRING_CAPS } from '../../constants/firmware-caps.js'
import { HexColorSchema } from '../common.js'

import { ButtonActionSchema } from './button-action.js'
import { SensorIconNameSchema } from './sensor-icon.js'

export const MIN_CYCLE_STATES = 2
export const MAX_CYCLE_STATES = 4

export const CycleButtonStateSchema = z
  .object({
    id: z.string().min(1).optional(),
    label: z.string().min(1).max(STRING_CAPS.WIDGET_LABEL),
    iconName: SensorIconNameSchema.optional(),
    colors: z
      .object({
        normal: HexColorSchema,
        active: HexColorSchema,
      })
      .strict()
      .optional(),
    action: ButtonActionSchema,
  })
  .strict()

const buttonBaseFields = {
  type: z.literal('button'),
  label: z.string().max(STRING_CAPS.WIDGET_LABEL),
  iconName: SensorIconNameSchema.optional(),
  iconPath: z.string().max(STRING_CAPS.ICON_PATH).optional(),
  showIcon: z.boolean().optional(),
  showLabel: z.boolean().optional(),
  isToggle: z.boolean().optional(),
  colors: z
    .object({
      normal: HexColorSchema,
      active: HexColorSchema,
    })
    .strict()
    .optional(),
}

export const SingleActionButtonConfigSchema = z
  .object({
    ...buttonBaseFields,
    mode: z.literal('single'),
    actions: z
      .array(ButtonActionSchema)
      .min(1, 'actions must contain at least one entry')
      .max(
        FIRMWARE_CAPS.MAX_BUTTON_ACTIONS,
        `actions cannot exceed ${FIRMWARE_CAPS.MAX_BUTTON_ACTIONS.toString()} entries (firmware cap)`
      ),
  })
  .strict()

export const CycleButtonConfigSchema = z
  .object({
    ...buttonBaseFields,
    mode: z.literal('cycle'),
    states: z
      .array(CycleButtonStateSchema)
      .min(
        MIN_CYCLE_STATES,
        `cycle states must contain at least ${String(MIN_CYCLE_STATES)} entries`
      )
      .max(MAX_CYCLE_STATES, `cycle states cannot exceed ${String(MAX_CYCLE_STATES)} entries`),
    initialActiveIndex: z.number().int().min(0),
  })
  .strict()

export const ButtonWidgetConfigSchema = z.discriminatedUnion('mode', [
  SingleActionButtonConfigSchema,
  CycleButtonConfigSchema,
])

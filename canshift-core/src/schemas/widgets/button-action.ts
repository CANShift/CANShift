import { z } from 'zod'

import {
  CAN_29BIT_MAX,
  CAN_RAW_DATA_MAX_HEX_CHARS,
  CAN_RAW_DATA_REGEX,
  MAP_INDEX_MAX,
} from '../../constants/firmware-caps.js'

const ActionIdSchema = z.string().min(1).optional()

const CAN_11BIT_MAX = 0x7ff

const NavigateActionSchema = z
  .object({
    id: ActionIdSchema,
    category: z.literal('dashboard'),
    type: z.literal('navigate'),
    pageId: z.string(),
  })
  .strict()

const MapSwitchActionSchema = z
  .object({
    id: ActionIdSchema,
    category: z.literal('ecu'),
    type: z.literal('map_switch'),
    mapIndex: z.number().int().min(0).max(MAP_INDEX_MAX),
  })
  .strict()

const CanRawDataSchema = z
  .string({ invalid_type_error: 'data must be a string' })
  .max(CAN_RAW_DATA_MAX_HEX_CHARS, {
    message: `data must be at most ${String(CAN_RAW_DATA_MAX_HEX_CHARS)} hex characters (8 bytes)`,
  })
  .regex(CAN_RAW_DATA_REGEX, 'data must be even-length hex (e.g. "DEADBEEF")')

const CanRawActionSchema = z
  .object({
    id: ActionIdSchema,
    category: z.literal('ecu'),
    type: z.literal('can_raw'),
    frameId: z.number().int().min(0).max(CAN_29BIT_MAX),
    data: CanRawDataSchema,
    dataOff: CanRawDataSchema.optional(),
    extended: z.boolean({ invalid_type_error: 'extended must be a boolean when set' }).optional(),
  })
  .strict()

export const CRUISE_CONTROL_OPS = [
  'on',
  'off',
  'toggle',
  'set',
  'resume',
  'increment',
  'decrement',
] as const

export const CruiseControlOpSchema = z.enum(CRUISE_CONTROL_OPS)

const CruiseControlActionSchema = z
  .object({
    id: ActionIdSchema,
    category: z.literal('ecu'),
    type: z.literal('cruise_control'),
    op: CruiseControlOpSchema,
    stepKmh: z.number().int().min(1).max(20).optional(),
  })
  .strict()

export const ButtonActionSchema = z
  .discriminatedUnion('type', [
    NavigateActionSchema,
    MapSwitchActionSchema,
    CanRawActionSchema,
    CruiseControlActionSchema,
  ])
  .superRefine((a, ctx) => {
    if (a.type === 'can_raw' && !a.extended && a.frameId > CAN_11BIT_MAX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['frameId'],
        message: '11-bit frameId must be <= 0x7FF unless extended=true',
      })
    }
  })

export type NavigateAction = z.infer<typeof NavigateActionSchema>
export type MapSwitchAction = z.infer<typeof MapSwitchActionSchema>
export type CanRawAction = z.infer<typeof CanRawActionSchema>
export type CruiseControlAction = z.infer<typeof CruiseControlActionSchema>
export type CruiseControlOp = z.infer<typeof CruiseControlOpSchema>
export type DashboardButtonAction = NavigateAction
export type EcuButtonAction = MapSwitchAction | CanRawAction | CruiseControlAction
export type ButtonAction = z.infer<typeof ButtonActionSchema>

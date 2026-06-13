import { z } from 'zod'

import { STRING_CAPS } from '../../constants/firmware-caps.js'
import { WidgetLayoutSchema, WidgetStyleSchema } from '../common.js'

import {
  CycleButtonConfigSchema,
  CycleButtonStateSchema,
  SingleActionButtonConfigSchema,
} from './button.js'
import { GaugeWidgetConfigSchema } from './gauge.js'
import { GearWidgetConfigSchema } from './gear.js'
import { ImageWidgetConfigSchema } from './image.js'
import { TimerWidgetConfigSchema } from './timer.js'
import { WarningWidgetConfigSchema } from './warning.js'

export { SensorIconNameSchema } from './sensor-icon.js'
export type { SensorIconName } from './sensor-icon.js'

export {
  GaugeArcFillStyleSchema,
  GaugeDisplayStyleSchema,
  GaugeWidgetConfigSchema,
} from './gauge.js'
export type { GaugeArcFillStyle, GaugeDisplayStyle } from './gauge.js'

export { WarningWidgetConfigSchema } from './warning.js'

export { ButtonActionSchema, CRUISE_CONTROL_OPS, CruiseControlOpSchema } from './button-action.js'
export type {
  ButtonAction,
  CanRawAction,
  CruiseControlAction,
  CruiseControlOp,
  DashboardButtonAction,
  EcuButtonAction,
  MapSwitchAction,
  NavigateAction,
} from './button-action.js'

export {
  ButtonWidgetConfigSchema,
  CycleButtonConfigSchema,
  CycleButtonStateSchema,
  MAX_CYCLE_STATES,
  MIN_CYCLE_STATES,
  SingleActionButtonConfigSchema,
} from './button.js'

export { TimerWidgetConfigSchema } from './timer.js'
export { GearWidgetConfigSchema } from './gear.js'
export { ImageWidgetConfigSchema } from './image.js'

export const WidgetConfigSchema = z.union([
  GaugeWidgetConfigSchema,
  WarningWidgetConfigSchema,
  SingleActionButtonConfigSchema,
  CycleButtonConfigSchema,
  TimerWidgetConfigSchema,
  GearWidgetConfigSchema,
  ImageWidgetConfigSchema,
])

export const WIDGET_TYPES = ['gauge', 'warning', 'button', 'timer', 'gear', 'image'] as const
export const WidgetTypeSchema = z.enum(WIDGET_TYPES)

const SIGNAL_CONSUMING_WIDGET_TYPES = new Set(['gauge', 'warning', 'gear'])

export const WidgetSchema = z
  .object({
    id: z.string().min(1, 'widget id must be a non-empty string'),
    type: WidgetTypeSchema,
    signal: z.string().max(STRING_CAPS.SIGNAL_NAME),
    layout: WidgetLayoutSchema,
    style: WidgetStyleSchema,
    config: WidgetConfigSchema,
  })
  .strict()
  .superRefine((w, ctx) => {
    if (SIGNAL_CONSUMING_WIDGET_TYPES.has(w.type) && w.signal.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `signal must be a non-empty string for ${w.type} widgets`,
        path: ['signal'],
      })
    }
    const cfg = w.config
    if (cfg.type === 'gauge') {
      if (cfg.minValue >= cfg.maxValue) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'gauge: minValue must be less than maxValue',
          path: ['config', 'maxValue'],
        })
      }
      if (cfg.dangerLevel < cfg.minValue || cfg.dangerLevel > cfg.maxValue) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'gauge: dangerLevel must be in [minValue, maxValue]',
          path: ['config', 'dangerLevel'],
        })
      }
    }
    if (cfg.type === 'button' && cfg.mode === 'cycle') {
      if (cfg.initialActiveIndex >= cfg.states.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `initialActiveIndex (${String(cfg.initialActiveIndex)}) must be less than states.length (${String(cfg.states.length)})`,
          path: ['config', 'initialActiveIndex'],
        })
      }
    }
  })

export type WidgetType = z.infer<typeof WidgetTypeSchema>

type OptionalKeys<T> = {
  [K in keyof T]-?: undefined extends T[K] ? K : never
}[keyof T]
type RequiredKeys<T> = {
  [K in keyof T]-?: undefined extends T[K] ? never : K
}[keyof T]
type ExactOptional<T> = {
  [K in RequiredKeys<T>]: T[K]
} & {
  [K in OptionalKeys<T>]?: Exclude<T[K], undefined>
}

export type GaugeWidgetConfig = ExactOptional<z.infer<typeof GaugeWidgetConfigSchema>>
export type WarningWidgetConfig = ExactOptional<z.infer<typeof WarningWidgetConfigSchema>>
export type SingleActionButtonConfig = ExactOptional<z.infer<typeof SingleActionButtonConfigSchema>>
export type CycleButtonConfig = ExactOptional<z.infer<typeof CycleButtonConfigSchema>>
export type ButtonWidgetConfig = SingleActionButtonConfig | CycleButtonConfig
export type CycleButtonState = ExactOptional<z.infer<typeof CycleButtonStateSchema>>
export type TimerWidgetConfig = ExactOptional<z.infer<typeof TimerWidgetConfigSchema>>
export type GearWidgetConfig = ExactOptional<z.infer<typeof GearWidgetConfigSchema>>
export type ImageWidgetConfig = ExactOptional<z.infer<typeof ImageWidgetConfigSchema>>

export type WidgetConfig =
  | GaugeWidgetConfig
  | WarningWidgetConfig
  | ButtonWidgetConfig
  | TimerWidgetConfig
  | GearWidgetConfig
  | ImageWidgetConfig

export type Widget = Omit<ExactOptional<z.infer<typeof WidgetSchema>>, 'config'> & {
  config: WidgetConfig
}

export { type ExactOptional }

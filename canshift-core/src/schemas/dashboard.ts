import { z } from 'zod'

import {
  CAN_29BIT_MAX,
  CAN_RAW_DATA_MAX_HEX_CHARS,
  CAN_RAW_DATA_REGEX,
  DECIMAL_PLACES,
  FIRMWARE_CAPS,
  MAP_INDEX_MAX,
  REV_LIMIT_RPM,
  STRING_CAPS,
  TOPBAR_HEIGHT,
} from '../constants/firmware-caps.js'

import { HexColorSchema, SemVerSchema, WidgetLayoutSchema, WidgetStyleSchema } from './common.js'
import { ScreenProfileIdSchema } from './screen-profile.js'

export const SensorIconNameSchema = z.enum([
  'rpm',
  'speed',
  'coolant',
  'oil_pressure',
  'oil_temp',
  'battery',
  'fuel',
  'afr',
  'boost',
  'throttle',
  'iat',
  'gear',
  'timer',
  'warning',
  'flame',
  'turbo',
  'engine',
  'brake',
  'launch',
  'traction',
  'map_icon',
  'exhaust',
  'cog',
])

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

export const WarningWidgetConfigSchema = z
  .object({
    type: z.literal('warning'),
    invertLogic: z.boolean().optional(),
    threshold: z.number(),
    iconName: SensorIconNameSchema.optional(),
  })
  .strict()

const ActionIdSchema = z.string().min(1).optional()

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

const CAN_11BIT_MAX = 0x7ff

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

export const TimerWidgetConfigSchema = z
  .object({
    type: z.literal('timer'),
    autoStart: z.boolean().optional(),
    format: z.enum(['mm:ss', 'ss.mmm']).optional(),
  })
  .strict()

export const GearWidgetConfigSchema = z
  .object({
    type: z.literal('gear'),
    decimalPlaces: z.literal(0),
    prefix: z.string().max(STRING_CAPS.WIDGET_PREFIX_SUFFIX).optional(),
    suffix: z.string().max(STRING_CAPS.WIDGET_PREFIX_SUFFIX).optional(),
  })
  .strict()

export const ImageWidgetConfigSchema = z
  .object({
    type: z.literal('image'),
    imagePath: z.string().max(STRING_CAPS.IMAGE_PATH),
  })
  .strict()

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

const SIGNAL_CONSUMING_WIDGET_TYPES = new Set(['gauge', 'warning', 'gear', 'timer'])

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

export const PagePaletteSchema = z
  .object({
    surface: HexColorSchema,
    primary: HexColorSchema,
    accent: HexColorSchema,
    text: HexColorSchema,
    textDim: HexColorSchema,
    warning: HexColorSchema,
    danger: HexColorSchema,
    success: HexColorSchema,
  })
  .strict()

export const DEFAULT_PAGE_PALETTE: z.infer<typeof PagePaletteSchema> = PagePaletteSchema.parse({
  surface: '#1E1E1E',
  primary: '#FF4444',
  accent: '#FF8800',
  text: '#FFFFFF',
  textDim: '#888888',
  warning: '#FF8800',
  danger: '#FF4444',
  success: '#00CC44',
})

export const ThemePresetSchema = z
  .object({
    bgColor: HexColorSchema,
    palette: PagePaletteSchema.optional(),
  })
  .strict()

export const PAGE_TEMPLATES = ['custom', 'cruise_control'] as const
export const PageTemplateSchema = z.enum(PAGE_TEMPLATES)

export const PageConfigSchema = z
  .object({
    id: z.string().min(1, 'page id must be a non-empty string'),
    backgroundImage: z.string().nullable(),
    backgroundColor: HexColorSchema,
    palette: PagePaletteSchema.optional(),
    showTopBar: z.boolean(),
    visible: z.boolean().optional(),
    template: PageTemplateSchema.optional(),
    widgets: z
      .array(WidgetSchema)
      .max(
        FIRMWARE_CAPS.MAX_WIDGETS_PER_PAGE,
        `widgets cannot exceed ${String(FIRMWARE_CAPS.MAX_WIDGETS_PER_PAGE)} entries (firmware cap)`
      ),
  })
  .strict()

export const TopBarItemPositionSchema = z.enum(['left', 'center', 'right'])

const iconOnlyTopBarItemShape = z.object({ position: TopBarItemPositionSchema })

const signalBoundTopBarItemShape = z.object({
  signal: z.string().min(1, 'signal must be a non-empty string').max(STRING_CAPS.SIGNAL_NAME),
  position: TopBarItemPositionSchema,
})

export const TopBarItemSchema = z.discriminatedUnion('type', [
  signalBoundTopBarItemShape.extend({ type: z.literal('statusDot') }).strict(),
  z
    .object({ type: z.literal('label'), text: z.string(), position: TopBarItemPositionSchema })
    .strict(),
  iconOnlyTopBarItemShape.extend({ type: z.literal('separator') }).strict(),
  signalBoundTopBarItemShape
    .extend({ type: z.literal('signal'), format: z.string().optional() })
    .strict(),
  iconOnlyTopBarItemShape.extend({ type: z.literal('usbIcon') }).strict(),
  iconOnlyTopBarItemShape.extend({ type: z.literal('bleIcon') }).strict(),
  iconOnlyTopBarItemShape.extend({ type: z.literal('themeToggle') }).strict(),
  signalBoundTopBarItemShape.extend({ type: z.literal('modeFlag'), text: z.string() }).strict(),
  iconOnlyTopBarItemShape.extend({ type: z.literal('trackBadge') }).strict(),
])

export const TopBarConfigSchema = z
  .object({
    height: z.number().min(TOPBAR_HEIGHT.MIN).max(TOPBAR_HEIGHT.MAX),
    bgColor: HexColorSchema,
    textColor: HexColorSchema,
    layout: z
      .array(TopBarItemSchema)
      .max(
        FIRMWARE_CAPS.MAX_TOPBAR_ITEMS,
        `topBar.layout cannot exceed ${String(FIRMWARE_CAPS.MAX_TOPBAR_ITEMS)} entries (firmware cap)`
      )
      .optional(),
  })
  .strict()

export const DEFAULT_TOP_BAR_LAYOUT = [
  { type: 'label', text: 'CAN', position: 'left' },
  { type: 'statusDot', signal: 'any', position: 'left' },
  { type: 'bleIcon', position: 'right' },
  { type: 'themeToggle', position: 'right' },
] as const satisfies readonly z.infer<typeof TopBarItemSchema>[]

export const DashboardConfigSchema = z
  .object({
    _comment: z.string().optional(),
    version: SemVerSchema,
    name: z.string().min(1, 'name must be a non-empty string'),
    description: z.string().optional(),
    defaultPageId: z.string().min(1, 'defaultPageId must be a non-empty string'),
    revLimitRpm: z.number().min(REV_LIMIT_RPM.MIN).max(REV_LIMIT_RPM.MAX),
    topBar: TopBarConfigSchema,
    dayTheme: ThemePresetSchema.optional(),
    nightTheme: ThemePresetSchema.optional(),
    pages: z
      .array(PageConfigSchema)
      .min(1, 'pages must contain at least one entry')
      .max(
        FIRMWARE_CAPS.MAX_PAGES,
        `pages cannot exceed ${String(FIRMWARE_CAPS.MAX_PAGES)} entries (firmware cap)`
      ),
    ecuProfileKey: z.string().optional(),
    targetProfile: ScreenProfileIdSchema.optional(),
  })
  .strict()

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

export type SensorIconName = z.infer<typeof SensorIconNameSchema>
export type WidgetType = z.infer<typeof WidgetTypeSchema>
export type GaugeDisplayStyle = z.infer<typeof GaugeDisplayStyleSchema>
export type GaugeArcFillStyle = z.infer<typeof GaugeArcFillStyleSchema>
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
export type PagePalette = z.infer<typeof PagePaletteSchema>
export type ThemePreset = z.infer<typeof ThemePresetSchema>
export type PageTemplate = z.infer<typeof PageTemplateSchema>
export type PageConfig = Omit<ExactOptional<z.infer<typeof PageConfigSchema>>, 'widgets'> & {
  widgets: Widget[]
}
export type TopBarItemPosition = z.infer<typeof TopBarItemPositionSchema>
export type TopBarItem = z.infer<typeof TopBarItemSchema>
export type TopBarConfig = ExactOptional<z.infer<typeof TopBarConfigSchema>>
export type DashboardConfig = Omit<
  ExactOptional<z.infer<typeof DashboardConfigSchema>>,
  'pages' | 'topBar'
> & {
  pages: PageConfig[]
  topBar: TopBarConfig
}

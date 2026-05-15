// schemas/dashboard.ts — Zod schemas for the dashboard config tree.
//
// Mirrors `types/dashboard.ts` field-for-field. Types listed at the bottom of
// this file are now derived via `z.infer` so the runtime schema is the single
// source of truth.

import { z } from 'zod'

import { CAN_RAW_DATA_MAX_HEX_CHARS, CAN_RAW_DATA_REGEX } from '../constants/firmware-caps.js'

import {
  HexColorSchema,
  SemVerSchema,
  WidgetLayoutSchema,
  WidgetStyleSchema,
  WidgetTypeSchema,
} from './common.js'

// ---------------------------------------------------------------------------
// Label position — used by gauge and bar widgets
// ---------------------------------------------------------------------------

export const WidgetLabelPositionSchema = z.enum([
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
])

// ---------------------------------------------------------------------------
// Sensor icon identifiers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Widget config variants (discriminated union on `type`)
// ---------------------------------------------------------------------------

export const GaugeDisplayStyleSchema = z.enum(['numeric', 'arc', 'bar'])
export const GaugeArcFillStyleSchema = z.enum(['zones', 'gradient'])
const BarOrientationSchema = z.enum(['vertical', 'horizontal'])

export const GaugeWidgetConfigSchema = z.object({
  type: z.literal('gauge'),
  displayStyle: GaugeDisplayStyleSchema,
  minValue: z.number(),
  maxValue: z.number(),
  warningLevel: z.number(),
  dangerLevel: z.number(),
  decimalPlaces: z.number(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  hideWhenInvalid: z.boolean().optional(),
  showNeedle: z.boolean().optional(),
  arcFillStyle: GaugeArcFillStyleSchema.optional(),
  revFlash: z.boolean().optional(),
  alertThreshold: z.number().optional(),
  barOrientation: BarOrientationSchema.optional(),
  label: z.string().optional(),
  labelPosition: WidgetLabelPositionSchema.optional(),
})

export const WarningWidgetConfigSchema = z.object({
  type: z.literal('warning'),
  invertLogic: z.boolean().optional(),
  threshold: z.number(),
  iconName: SensorIconNameSchema.optional(),
  label: z.string().optional(),
  labelPosition: WidgetLabelPositionSchema.optional(),
})

// ---------------------------------------------------------------------------
// Button action types — discriminated union on `category` + `type` (issue #673)
// ---------------------------------------------------------------------------

const NavigateActionSchema = z.object({
  category: z.literal('dashboard'),
  type: z.literal('navigate'),
  pageId: z.string(),
})

const MapSwitchActionSchema = z.object({
  category: z.literal('ecu'),
  type: z.literal('map_switch'),
  mapIndex: z.number(),
})

const CanRawDataSchema = z
  .string({ invalid_type_error: 'data must be a string' })
  .max(CAN_RAW_DATA_MAX_HEX_CHARS, {
    message: `data must be at most ${String(CAN_RAW_DATA_MAX_HEX_CHARS)} hex characters (8 bytes)`,
  })
  .regex(CAN_RAW_DATA_REGEX, 'data must be even-length hex (e.g. "DEADBEEF")')

const CanRawActionSchema = z.object({
  category: z.literal('ecu'),
  type: z.literal('can_raw'),
  frameId: z.number(),
  data: CanRawDataSchema,
  dataOff: CanRawDataSchema.optional(),
  extended: z.boolean({ invalid_type_error: 'extended must be a boolean when set' }).optional(),
})

/**
 * Discriminated union of all button actions.
 *
 * The pair `(category, type)` is the conceptual discriminator. Each `type`
 * value is unique across categories (`navigate` → dashboard, `map_switch` and
 * `can_raw` → ecu), so a single-key discriminated union on `type` is
 * sufficient and produces sharper errors than `z.union(...)`. The `category`
 * literal on each variant is still enforced, so unknown / mismatched
 * combinations are rejected.
 *
 * The legacy `targetPageId` field that lived on `ButtonWidgetConfig` (and was
 * removed during the 1.0→1.1 migration, issue #672) is NOT part of any action
 * variant. Adding it to an action will fail validation, by design.
 */
export const ButtonActionSchema = z.discriminatedUnion('type', [
  NavigateActionSchema,
  MapSwitchActionSchema,
  CanRawActionSchema,
])

// Individual variants are re-exported as types for downstream consumers
// (mobile, studio) that hold references to them.
export type NavigateAction = z.infer<typeof NavigateActionSchema>
export type MapSwitchAction = z.infer<typeof MapSwitchActionSchema>
export type CanRawAction = z.infer<typeof CanRawActionSchema>
export type DashboardButtonAction = NavigateAction
export type EcuButtonAction = MapSwitchAction | CanRawAction
export type ButtonAction = z.infer<typeof ButtonActionSchema>

/**
 * Runtime tuple of valid `(category, type)` pairs for ButtonAction (issue
 * #716). Single source of truth for action-editor UIs — consumers can iterate
 * instead of hand-maintaining a list that drifts from the schema above.
 */
export const BUTTON_ACTION_TYPES = [
  { category: 'dashboard', type: 'navigate' },
  { category: 'ecu', type: 'map_switch' },
  { category: 'ecu', type: 'can_raw' },
] as const

export function isNavigateAction(action: ButtonAction): action is NavigateAction {
  return action.category === 'dashboard'
}

export function isMapSwitchAction(action: ButtonAction): action is MapSwitchAction {
  return action.type === 'map_switch'
}

export function isCanRawAction(action: ButtonAction): action is CanRawAction {
  return action.type === 'can_raw'
}

// ---------------------------------------------------------------------------
// Button widget config
// ---------------------------------------------------------------------------

export const ButtonWidgetConfigSchema = z.object({
  type: z.literal('button'),
  label: z.string(),
  iconName: SensorIconNameSchema.optional(),
  iconPath: z.string().optional(),
  showIcon: z.boolean().optional(),
  showLabel: z.boolean().optional(),
  isToggle: z.boolean().optional(),
  colors: z
    .object({
      normal: HexColorSchema,
      active: HexColorSchema,
    })
    .optional(),
  actions: z.array(ButtonActionSchema),
})

export const TimerWidgetConfigSchema = z.object({
  type: z.literal('timer'),
  autoStart: z.boolean().optional(),
  format: z.enum(['mm:ss', 'ss.mmm']).optional(),
  label: z.string().optional(),
  labelPosition: WidgetLabelPositionSchema.optional(),
})

export const BarWidgetConfigSchema = z.object({
  type: z.literal('bar'),
  decimalPlaces: z.number(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  label: z.string().optional(),
  labelPosition: z.enum(['top-center', 'bottom-center']).optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  warningLevel: z.number().optional(),
  dangerLevel: z.number().optional(),
  alertThreshold: z.number().optional(),
})

export const GearWidgetConfigSchema = z.object({
  type: z.literal('gear'),
  decimalPlaces: z.literal(0),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  hideWhenInvalid: z.boolean().optional(),
  label: z.string().optional(),
  labelPosition: WidgetLabelPositionSchema.optional(),
})

export const ImageWidgetConfigSchema = z.object({
  type: z.literal('image'),
  imagePath: z.string(),
  label: z.string().optional(),
  labelPosition: WidgetLabelPositionSchema.optional(),
})

export const WidgetConfigSchema = z.discriminatedUnion('type', [
  GaugeWidgetConfigSchema,
  WarningWidgetConfigSchema,
  ButtonWidgetConfigSchema,
  TimerWidgetConfigSchema,
  BarWidgetConfigSchema,
  GearWidgetConfigSchema,
  ImageWidgetConfigSchema,
])

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

export const WidgetSchema = z.object({
  id: z.string(),
  type: WidgetTypeSchema,
  signal: z.string(),
  layout: WidgetLayoutSchema,
  style: WidgetStyleSchema,
  config: WidgetConfigSchema,
})

// ---------------------------------------------------------------------------
// Page palette + theme
// ---------------------------------------------------------------------------

export const PagePaletteSchema = z.object({
  surface: HexColorSchema,
  primary: HexColorSchema,
  accent: HexColorSchema,
  text: HexColorSchema,
  textDim: HexColorSchema,
  warning: HexColorSchema,
  danger: HexColorSchema,
  success: HexColorSchema,
})

export const DEFAULT_PAGE_PALETTE: z.infer<typeof PagePaletteSchema> = {
  surface: '#1E1E1E',
  primary: '#FF4444',
  accent: '#FF8800',
  text: '#FFFFFF',
  textDim: '#888888',
  warning: '#FF8800',
  danger: '#FF4444',
  success: '#00CC44',
}

export const ThemePresetSchema = z.object({
  bgColor: HexColorSchema,
  palette: PagePaletteSchema,
})

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export const PageConfigSchema = z.object({
  id: z.string(),
  backgroundImage: z.string().nullable(),
  backgroundColor: HexColorSchema,
  palette: PagePaletteSchema,
  showTopBar: z.boolean(),
  visible: z.boolean().optional(),
  widgets: z.array(WidgetSchema),
})

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------

export const TopBarItemPositionSchema = z.enum(['left', 'center', 'right'])

export const TopBarItemSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('statusDot'),
    signal: z.string(),
    position: TopBarItemPositionSchema,
  }),
  z.object({ type: z.literal('label'), text: z.string(), position: TopBarItemPositionSchema }),
  z.object({ type: z.literal('separator'), position: TopBarItemPositionSchema }),
  z.object({
    type: z.literal('signal'),
    signal: z.string(),
    format: z.string().optional(),
    position: TopBarItemPositionSchema,
  }),
  z.object({ type: z.literal('usbIcon'), position: TopBarItemPositionSchema }),
  z.object({ type: z.literal('bleIcon'), position: TopBarItemPositionSchema }),
  z.object({ type: z.literal('themeToggle'), position: TopBarItemPositionSchema }),
  z.object({
    type: z.literal('modeFlag'),
    signal: z.string(),
    text: z.string(),
    position: TopBarItemPositionSchema,
  }),
])

export const TopBarConfigSchema = z.object({
  height: z.number(),
  bgColor: HexColorSchema,
  textColor: HexColorSchema,
  layout: z.array(TopBarItemSchema).optional(),
})

export const DEFAULT_TOP_BAR_LAYOUT: z.infer<typeof TopBarItemSchema>[] = [
  { type: 'statusDot', signal: 'any', position: 'left' },
  { type: 'label', text: 'CAN', position: 'left' },
  { type: 'bleIcon', position: 'right' },
  { type: 'usbIcon', position: 'right' },
  { type: 'separator', position: 'right' },
  { type: 'themeToggle', position: 'right' },
]

// ---------------------------------------------------------------------------
// Dashboard root
// ---------------------------------------------------------------------------

export const DashboardConfigSchema = z.object({
  version: SemVerSchema,
  name: z.string(),
  description: z.string().optional(),
  defaultPageId: z.string(),
  revLimitRpm: z.number(),
  topBar: TopBarConfigSchema,
  dayTheme: ThemePresetSchema.optional(),
  pages: z.array(PageConfigSchema),
  ecuProfileKey: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Inferred types — these REPLACE the previous hand-written interfaces in
// types/dashboard.ts (re-exported from there for back-compat).
//
// Note on `exactOptionalPropertyTypes`: Zod's `.optional()` produces
// `field?: T | undefined` on the inferred type. Studio compiles with
// `exactOptionalPropertyTypes: true`, which treats `field?: T` and
// `field?: T | undefined` as different. We strip the explicit `undefined`
// from optional fields via `ExactOptional` so the new derived types stay
// drop-in compatible with the previous hand-written interfaces.
// ---------------------------------------------------------------------------

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

export type WidgetLabelPosition = z.infer<typeof WidgetLabelPositionSchema>
export type SensorIconName = z.infer<typeof SensorIconNameSchema>
export type GaugeDisplayStyle = z.infer<typeof GaugeDisplayStyleSchema>
export type GaugeArcFillStyle = z.infer<typeof GaugeArcFillStyleSchema>
export type GaugeWidgetConfig = ExactOptional<z.infer<typeof GaugeWidgetConfigSchema>>
export type WarningWidgetConfig = ExactOptional<z.infer<typeof WarningWidgetConfigSchema>>
export type ButtonWidgetConfig = ExactOptional<z.infer<typeof ButtonWidgetConfigSchema>>
export type TimerWidgetConfig = ExactOptional<z.infer<typeof TimerWidgetConfigSchema>>
export type BarWidgetConfig = ExactOptional<z.infer<typeof BarWidgetConfigSchema>>
export type GearWidgetConfig = ExactOptional<z.infer<typeof GearWidgetConfigSchema>>
export type ImageWidgetConfig = ExactOptional<z.infer<typeof ImageWidgetConfigSchema>>
export type WidgetConfig =
  | GaugeWidgetConfig
  | WarningWidgetConfig
  | ButtonWidgetConfig
  | TimerWidgetConfig
  | BarWidgetConfig
  | GearWidgetConfig
  | ImageWidgetConfig
// `Widget.config` MUST surface the public `WidgetConfig` union (with
// `ExactOptional` applied per variant), not the raw `z.infer` form — otherwise
// optional fields inside the variants reappear as `T | undefined` and break
// strict consumers (studio compiles with `exactOptionalPropertyTypes: true`).
export type Widget = Omit<ExactOptional<z.infer<typeof WidgetSchema>>, 'config'> & {
  config: WidgetConfig
}
export type PagePalette = z.infer<typeof PagePaletteSchema>
export type ThemePreset = z.infer<typeof ThemePresetSchema>
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

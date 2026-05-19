// schemas/dashboard.ts — Zod schemas for the dashboard config tree.
//
// Mirrors `types/dashboard.ts` field-for-field. Types listed at the bottom of
// this file are now derived via `z.infer` so the runtime schema is the single
// source of truth.

import { z } from 'zod'

import {
  CAN_RAW_DATA_MAX_HEX_CHARS,
  CAN_RAW_DATA_REGEX,
  DECIMAL_PLACES,
  FIRMWARE_CAPS,
  REV_LIMIT_RPM,
  TOPBAR_HEIGHT,
} from '../constants/firmware-caps.js'

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

export const GaugeWidgetConfigSchema = z
  .object({
    type: z.literal('gauge'),
    displayStyle: GaugeDisplayStyleSchema,
    minValue: z.number(),
    maxValue: z.number(),
    // Single threshold (issue #965) — value >= dangerLevel turns the gauge
    // red (or the sensor palette's warning colour). Replaces the legacy
    // warningLevel + dangerLevel pair, dropped because the two-zone palette
    // (#954) only needs one cut-off.
    dangerLevel: z.number(),
    decimalPlaces: z.number().int().min(DECIMAL_PLACES.MIN).max(DECIMAL_PLACES.MAX),
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
    // Sensor identifier — drives the semantic two-zone palette (issue #954).
    // When set to a known name, gauge fills opaquely in the per-sensor OK
    // colour below `dangerLevel` and the warning colour above. Unset or
    // unknown keeps the legacy `style.primaryColor` path.
    iconName: SensorIconNameSchema.optional(),
  })
  .strict()

export const WarningWidgetConfigSchema = z
  .object({
    type: z.literal('warning'),
    invertLogic: z.boolean().optional(),
    threshold: z.number(),
    iconName: SensorIconNameSchema.optional(),
    label: z.string().optional(),
    labelPosition: WidgetLabelPositionSchema.optional(),
  })
  .strict()

// ---------------------------------------------------------------------------
// Button action types — discriminated union on `category` + `type` (issue #673)
// ---------------------------------------------------------------------------

const NavigateActionSchema = z
  .object({
    category: z.literal('dashboard'),
    type: z.literal('navigate'),
    pageId: z.string(),
  })
  .strict()

const MapSwitchActionSchema = z
  .object({
    category: z.literal('ecu'),
    type: z.literal('map_switch'),
    mapIndex: z.number(),
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
    category: z.literal('ecu'),
    type: z.literal('can_raw'),
    frameId: z.number(),
    data: CanRawDataSchema,
    dataOff: CanRawDataSchema.optional(),
    extended: z.boolean({ invalid_type_error: 'extended must be a boolean when set' }).optional(),
  })
  .strict()

// Cruise-control operations a button or input binding can request. `toggle`
// flips the armed state; `set`/`resume` are commonly emitted by steering-wheel
// SET / RES buttons; `increment`/`decrement` adjust the setpoint, optionally
// by `stepKmh` (defaults applied by firmware). Issue #833 / consumer #451.
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
    category: z.literal('ecu'),
    type: z.literal('cruise_control'),
    op: CruiseControlOpSchema,
    // Only consulted by firmware for `increment` / `decrement`. Constrained to
    // a sane range so a fat-fingered value can't push the setpoint by 200 km/h.
    stepKmh: z.number().int().min(1).max(20).optional(),
  })
  .strict()

/**
 * Discriminated union of all button actions.
 *
 * The pair `(category, type)` is the conceptual discriminator. Each `type`
 * value is unique across categories (`navigate` → dashboard, `map_switch` /
 * `can_raw` / `cruise_control` → ecu), so a single-key discriminated union on
 * `type` is sufficient and produces sharper errors than `z.union(...)`. The
 * `category` literal on each variant is still enforced, so unknown /
 * mismatched combinations are rejected.
 *
 * The legacy `targetPageId` field that lived on `ButtonWidgetConfig` (and was
 * removed during the 1.0→1.1 migration, issue #672) is NOT part of any action
 * variant. Adding it to an action will fail validation, by design.
 */
export const ButtonActionSchema = z.discriminatedUnion('type', [
  NavigateActionSchema,
  MapSwitchActionSchema,
  CanRawActionSchema,
  CruiseControlActionSchema,
])

// Individual variants are re-exported as types for downstream consumers
// (mobile, studio) that hold references to them.
export type NavigateAction = z.infer<typeof NavigateActionSchema>
export type MapSwitchAction = z.infer<typeof MapSwitchActionSchema>
export type CanRawAction = z.infer<typeof CanRawActionSchema>
export type CruiseControlAction = z.infer<typeof CruiseControlActionSchema>
export type CruiseControlOp = z.infer<typeof CruiseControlOpSchema>
export type DashboardButtonAction = NavigateAction
export type EcuButtonAction = MapSwitchAction | CanRawAction | CruiseControlAction
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
  { category: 'ecu', type: 'cruise_control' },
] as const

export function isNavigateAction(action: ButtonAction): action is NavigateAction {
  return action.type === 'navigate'
}

export function isMapSwitchAction(action: ButtonAction): action is MapSwitchAction {
  return action.type === 'map_switch'
}

export function isCanRawAction(action: ButtonAction): action is CanRawAction {
  return action.type === 'can_raw'
}

export function isCruiseControlAction(action: ButtonAction): action is CruiseControlAction {
  return action.type === 'cruise_control'
}

// ---------------------------------------------------------------------------
// Button widget config
// ---------------------------------------------------------------------------

export const ButtonWidgetConfigSchema = z
  .object({
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
      .strict()
      .optional(),
    // Firmware mirrors this cap as a fixed C array — over-limit configs lose
    // their tail actions silently on-device. Enforce at the schema boundary
    // so Studio surfaces it as a validation error (#700).
    actions: z
      .array(ButtonActionSchema)
      .min(1, 'actions must contain at least one entry')
      .max(
        FIRMWARE_CAPS.MAX_BUTTON_ACTIONS,
        `actions cannot exceed ${FIRMWARE_CAPS.MAX_BUTTON_ACTIONS.toString()} entries (firmware cap)`
      ),
  })
  .strict()

export const TimerWidgetConfigSchema = z
  .object({
    type: z.literal('timer'),
    autoStart: z.boolean().optional(),
    format: z.enum(['mm:ss', 'ss.mmm']).optional(),
    label: z.string().optional(),
    labelPosition: WidgetLabelPositionSchema.optional(),
  })
  .strict()

export const BarWidgetConfigSchema = z
  .object({
    type: z.literal('bar'),
    decimalPlaces: z.number().int().min(DECIMAL_PLACES.MIN).max(DECIMAL_PLACES.MAX),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    label: z.string().optional(),
    labelPosition: z.enum(['top-center', 'bottom-center']).optional(),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    // Single threshold (issue #965) — see GaugeWidgetConfigSchema.
    dangerLevel: z.number().optional(),
    alertThreshold: z.number().optional(),
    // Sensor identifier — drives the semantic two-zone palette (issue #954).
    // Same semantics as on `GaugeWidgetConfig`.
    iconName: SensorIconNameSchema.optional(),
  })
  .strict()

export const GearWidgetConfigSchema = z
  .object({
    type: z.literal('gear'),
    decimalPlaces: z.literal(0),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    hideWhenInvalid: z.boolean().optional(),
    label: z.string().optional(),
    labelPosition: WidgetLabelPositionSchema.optional(),
  })
  .strict()

export const ImageWidgetConfigSchema = z
  .object({
    type: z.literal('image'),
    imagePath: z.string(),
    label: z.string().optional(),
    labelPosition: WidgetLabelPositionSchema.optional(),
  })
  .strict()

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

export const WidgetSchema = z
  .object({
    id: z.string().min(1, 'widget id must be a non-empty string'),
    type: WidgetTypeSchema,
    signal: z.string(),
    layout: WidgetLayoutSchema,
    style: WidgetStyleSchema,
    config: WidgetConfigSchema,
  })
  .strict()
  .superRefine((w, ctx) => {
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
    } else if (cfg.type === 'bar') {
      if (
        cfg.minValue !== undefined &&
        cfg.maxValue !== undefined &&
        cfg.minValue >= cfg.maxValue
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'bar: minValue must be less than maxValue',
          path: ['config', 'maxValue'],
        })
      }
      if (
        cfg.dangerLevel !== undefined &&
        cfg.minValue !== undefined &&
        cfg.maxValue !== undefined &&
        (cfg.dangerLevel < cfg.minValue || cfg.dangerLevel > cfg.maxValue)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'bar: dangerLevel must be in [minValue, maxValue]',
          path: ['config', 'dangerLevel'],
        })
      }
    }
  })

// ---------------------------------------------------------------------------
// Page palette + theme
// ---------------------------------------------------------------------------

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

export const ThemePresetSchema = z
  .object({
    bgColor: HexColorSchema,
    // Falls back to DEFAULT_PAGE_PALETTE when omitted — firmware demo configs
    // ship without an explicit palette and rely on the default.
    palette: PagePaletteSchema.optional(),
  })
  .strict()

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export const PageConfigSchema = z
  .object({
    id: z.string().min(1, 'page id must be a non-empty string'),
    backgroundImage: z.string().nullable(),
    backgroundColor: HexColorSchema,
    // Falls back to DEFAULT_PAGE_PALETTE when omitted — firmware demo configs
    // ship without explicit palettes.
    palette: PagePaletteSchema.optional(),
    showTopBar: z.boolean(),
    visible: z.boolean().optional(),
    // Firmware allocates a fixed-size widget array per page — over-limit configs
    // would silently drop tail widgets at load time. Enforce at the boundary.
    widgets: z
      .array(WidgetSchema)
      .max(
        FIRMWARE_CAPS.MAX_WIDGETS_PER_PAGE,
        `widgets cannot exceed ${String(FIRMWARE_CAPS.MAX_WIDGETS_PER_PAGE)} entries (firmware cap)`
      ),
  })
  .strict()

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------

export const TopBarItemPositionSchema = z.enum(['left', 'center', 'right'])

export const TopBarItemSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('statusDot'),
      signal: z.string(),
      position: TopBarItemPositionSchema,
    })
    .strict(),
  z
    .object({ type: z.literal('label'), text: z.string(), position: TopBarItemPositionSchema })
    .strict(),
  z.object({ type: z.literal('separator'), position: TopBarItemPositionSchema }).strict(),
  z
    .object({
      type: z.literal('signal'),
      signal: z.string(),
      format: z.string().optional(),
      position: TopBarItemPositionSchema,
    })
    .strict(),
  z.object({ type: z.literal('usbIcon'), position: TopBarItemPositionSchema }).strict(),
  z.object({ type: z.literal('bleIcon'), position: TopBarItemPositionSchema }).strict(),
  z.object({ type: z.literal('themeToggle'), position: TopBarItemPositionSchema }).strict(),
  z
    .object({
      type: z.literal('modeFlag'),
      signal: z.string(),
      text: z.string(),
      position: TopBarItemPositionSchema,
    })
    .strict(),
  // Track-mode indicator — lit when canshift-mobile pushes `trackMode: true`
  // through the BLE CMD `track_state` envelope. Issue #844.
  z.object({ type: z.literal('trackBadge'), position: TopBarItemPositionSchema }).strict(),
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

export const DashboardConfigSchema = z
  .object({
    // Allow a top-level `_comment` for JSON-side documentation (firmware demos
    // use it). Validated as a string so a stray non-string `_comment` still
    // surfaces as an issue.
    _comment: z.string().optional(),
    version: SemVerSchema,
    name: z.string().min(1, 'name must be a non-empty string'),
    description: z.string().optional(),
    defaultPageId: z.string().min(1, 'defaultPageId must be a non-empty string'),
    revLimitRpm: z.number().min(REV_LIMIT_RPM.MIN).max(REV_LIMIT_RPM.MAX),
    topBar: TopBarConfigSchema,
    dayTheme: ThemePresetSchema.optional(),
    // Firmware allocates a fixed page array — over-limit configs would silently
    // drop tail pages at load time. `min(1)` because a 0-page dashboard would
    // boot with no content to render.
    pages: z
      .array(PageConfigSchema)
      .min(1, 'pages must contain at least one entry')
      .max(
        FIRMWARE_CAPS.MAX_PAGES,
        `pages cannot exceed ${String(FIRMWARE_CAPS.MAX_PAGES)} entries (firmware cap)`
      ),
    ecuProfileKey: z.string().optional(),
  })
  .strict()

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

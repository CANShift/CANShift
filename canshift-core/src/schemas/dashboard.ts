// schemas/dashboard.ts — Zod schemas for the dashboard config tree.
//
// Mirrors `types/dashboard.ts` field-for-field. Types listed at the bottom of
// this file are now derived via `z.infer` so the runtime schema is the single
// source of truth.

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

export const GaugeDisplayStyleSchema = z.enum(['numeric', 'arc'])
export const GaugeArcFillStyleSchema = z.enum(['zones', 'gradient'])

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
    prefix: z.string().max(STRING_CAPS.WIDGET_PREFIX_SUFFIX).optional(),
    suffix: z.string().max(STRING_CAPS.WIDGET_PREFIX_SUFFIX).optional(),
    showNeedle: z.boolean().optional(),
    arcFillStyle: GaugeArcFillStyleSchema.optional(),
    revFlash: z.boolean().optional(),
    alertThreshold: z.number().optional(),
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
  })
  .strict()

// ---------------------------------------------------------------------------
// Button action types — discriminated union on `category` + `type` (issue #673)
// ---------------------------------------------------------------------------

// Optional stable id per action — used by editors (Studio button-fields panel)
// to key reorderable rows so DOM state (Radix focus, IME) doesn't shift when
// an action is removed (R-5, issue #1288). Persisted when present; absent on
// configs authored before this field existed. Editors generate one at
// creation time or migrate at read time via a WeakMap fallback.
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

// Standard 11-bit CAN identifier upper bound. `extended=true` selects 29-bit
// framing (up to `CAN_29BIT_MAX`); when omitted or `false`, `frameId` must fit
// in 11 bits or firmware silently truncates the upper bits / emits a malformed
// frame (#1289). The cross-field guard runs on `ButtonActionSchema` below so
// the variant stays a `ZodObject` (required by `z.discriminatedUnion`).
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
    id: ActionIdSchema,
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
export const ButtonActionSchema = z
  .discriminatedUnion('type', [
    NavigateActionSchema,
    MapSwitchActionSchema,
    CanRawActionSchema,
    CruiseControlActionSchema,
  ])
  // `can_raw` with `extended` omitted or `false` must fit in the 11-bit range;
  // firmware silently truncates upper bits or emits a malformed frame otherwise
  // (#1289). Runs at the union level so the inner variant stays a `ZodObject`
  // (required by `z.discriminatedUnion`).
  .superRefine((a, ctx) => {
    if (a.type === 'can_raw' && !a.extended && a.frameId > CAN_11BIT_MAX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['frameId'],
        message: '11-bit frameId must be <= 0x7FF unless extended=true',
      })
    }
  })

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

// ---------------------------------------------------------------------------
// Button widget config
// ---------------------------------------------------------------------------

export const ButtonWidgetConfigSchema = z
  .object({
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

export const WidgetConfigSchema = z.discriminatedUnion('type', [
  GaugeWidgetConfigSchema,
  WarningWidgetConfigSchema,
  ButtonWidgetConfigSchema,
  TimerWidgetConfigSchema,
  GearWidgetConfigSchema,
  ImageWidgetConfigSchema,
])

/**
 * Widget type discriminant — derived from `WidgetConfigSchema.options` so the
 * enum can never drift from the union of supported widget variants. Adding a
 * new config schema to the union above automatically extends this enum (audit
 * C-LO-2, umbrella #1016). The `WidgetConfigValueType` indirection narrows the
 * `z.enum` tuple to the variant literals — a plain `string[]` cast would
 * widen the inferred `WidgetType` back to `string`.
 */
type WidgetConfigValueType =
  (typeof WidgetConfigSchema)['options'][number]['shape']['type']['value']
export const WidgetTypeSchema = z.enum(
  WidgetConfigSchema.options.map((o) => o.shape.type.value) as [
    WidgetConfigValueType,
    ...WidgetConfigValueType[],
  ]
)

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

// Widget variants that consume a signal value on-device. Button widgets emit
// actions and image widgets render a static asset — they ship with `signal: ""`
// in the firmware demo and studio defaults, so empty signals are legal on those
// variants. The rest produce a catalog-lookup miss when bound to an empty
// string, so we reject that at the boundary (#1289).
const SIGNAL_CONSUMING_WIDGET_TYPES = new Set(['gauge', 'warning', 'gear', 'timer'])

export const WidgetSchema = z
  .object({
    id: z.string().min(1, 'widget id must be a non-empty string'),
    type: WidgetTypeSchema,
    // Capped to mirror `SignalDef.name` — an over-cap name overflows firmware's
    // fixed-buffer copy. The non-empty guard is enforced per-variant below
    // because button/image widgets legitimately ship without a signal binding
    // (#1289).
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
// Page template — built-in screen layouts that bypass the free-form widget grid
// ---------------------------------------------------------------------------

// Page rendering mode.
//
// `custom` (default + back-compat): the firmware draws the page from the
// `widgets[]` array exactly as today.
//
// `cruise_control` (issue #451): the firmware draws a fixed 2×2 grid of
// touch-targets (+, −, SET, OFF) wired to the corresponding `cruise_control`
// action operations. The page's `widgets[]` array is **ignored** when this
// template is active — the studio renders a placeholder preview in its place
// and gates widget editing on the same condition. Studio still keeps the
// widgets[] field so a user can flip the template back to `custom` without
// losing a previously authored layout.
export const PAGE_TEMPLATES = ['custom', 'cruise_control'] as const
export const PageTemplateSchema = z.enum(PAGE_TEMPLATES)

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
    // Optional page rendering template (issue #451). Omitted = `custom`, which
    // preserves the legacy free-form widgets[] behavior. When set to a built-in
    // template (e.g. `cruise_control`), the firmware draws a procedural layout
    // and ignores `widgets[]`.
    template: PageTemplateSchema.optional(),
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

/**
 * Common shape for icon-only top-bar items — variants that carry no payload
 * beyond the discriminator and the layout position (separator, usbIcon,
 * bleIcon, themeToggle, trackBadge). Each variant `.extend`s this with its
 * own `type` literal so the four+ variants share one definition instead of
 * duplicating the strict object (audit C-LO-3, umbrella #1016).
 */
const iconOnlyTopBarItemShape = z.object({ position: TopBarItemPositionSchema })

/**
 * Common shape for signal-bound top-bar items — variants whose payload is
 * a `signal` reference plus the layout position (statusDot, signal,
 * modeFlag). Variants `.extend` with their own `type` literal and any
 * variant-specific fields (`signal` adds optional `format`, `modeFlag`
 * adds `text`).
 */
const signalBoundTopBarItemShape = z.object({
  // Bounded to mirror `SignalDef.name`'s cap — same rationale as
  // `WidgetSchema.signal` (#1289).
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
  // Track-mode indicator — lit when canshift-mobile pushes `trackMode: true`
  // through the BLE CMD `track_state` envelope. Issue #844.
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

// Exported as `readonly` so consumers can't mutate the shared default.
// A stray `DEFAULT_TOP_BAR_LAYOUT.push(...)` somewhere in the renderer would
// otherwise pollute every downstream caller (audit C-ME-5).
export const DEFAULT_TOP_BAR_LAYOUT = [
  { type: 'label', text: 'CAN', position: 'left' },
  { type: 'statusDot', signal: 'any', position: 'left' },
  { type: 'bleIcon', position: 'right' },
  { type: 'themeToggle', position: 'right' },
] as const satisfies readonly z.infer<typeof TopBarItemSchema>[]

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
    // Optional night-mode theme (issue #21 v2). Mirrors `dayTheme` — when
    // absent, the studio canvas and firmware fall back to per-page palette /
    // page-level `backgroundColor`, matching pre-#21 behaviour. v2 ships the
    // schema + studio editor surface; firmware-side read lands in a follow-up
    // so existing dashboards stay byte-compatible with current firmware.
    nightTheme: ThemePresetSchema.optional(),
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
    // Target screen profile this dashboard was authored against (issue #548).
    // Optional for backward compatibility — dashboards written before this
    // field existed parse cleanly and are resolved to `DEFAULT_SCREEN_PROFILE_ID`
    // (`crowpanel-28`, 320×240) by `resolveScreenProfile` at the read side.
    // Firmware v1 reads but ignores the value; phase 2 (#17 multi-board) and
    // phase 3 (#18 multi-screen LVGL) will branch off it.
    targetProfile: ScreenProfileIdSchema.optional(),
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

export type SensorIconName = z.infer<typeof SensorIconNameSchema>
/** Widget type discriminant — derived from `WidgetConfigSchema`. */
export type WidgetType = z.infer<typeof WidgetTypeSchema>
export type GaugeDisplayStyle = z.infer<typeof GaugeDisplayStyleSchema>
export type GaugeArcFillStyle = z.infer<typeof GaugeArcFillStyleSchema>
export type GaugeWidgetConfig = ExactOptional<z.infer<typeof GaugeWidgetConfigSchema>>
export type WarningWidgetConfig = ExactOptional<z.infer<typeof WarningWidgetConfigSchema>>
export type ButtonWidgetConfig = ExactOptional<z.infer<typeof ButtonWidgetConfigSchema>>
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
// `Widget.config` MUST surface the public `WidgetConfig` union (with
// `ExactOptional` applied per variant), not the raw `z.infer` form — otherwise
// optional fields inside the variants reappear as `T | undefined` and break
// strict consumers (studio compiles with `exactOptionalPropertyTypes: true`).
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

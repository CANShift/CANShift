import { z } from 'zod'

import {
  FIRMWARE_CAPS,
  REV_LIMIT_RPM,
  STRING_CAPS,
  TOPBAR_HEIGHT,
} from '../constants/firmware-caps.js'

import { HexColorSchema, SemVerSchema } from './common.js'
import { ScreenProfileIdSchema } from './screen-profile.js'
import { type ExactOptional, WidgetSchema, type Widget } from './widgets/index.js'

export {
  ButtonActionSchema,
  ButtonWidgetConfigSchema,
  CRUISE_CONTROL_OPS,
  CruiseControlOpSchema,
  CycleButtonConfigSchema,
  CycleButtonStateSchema,
  GaugeArcFillStyleSchema,
  GaugeDisplayStyleSchema,
  GaugeWidgetConfigSchema,
  GearWidgetConfigSchema,
  ImageWidgetConfigSchema,
  MAX_CYCLE_STATES,
  MIN_CYCLE_STATES,
  SensorIconNameSchema,
  SingleActionButtonConfigSchema,
  TimerWidgetConfigSchema,
  WarningWidgetConfigSchema,
  WIDGET_TYPES,
  WidgetConfigSchema,
  WidgetSchema,
  WidgetTypeSchema,
} from './widgets/index.js'

export type {
  ButtonAction,
  ButtonWidgetConfig,
  CanRawAction,
  CruiseControlAction,
  CruiseControlOp,
  CycleButtonConfig,
  CycleButtonState,
  DashboardButtonAction,
  EcuButtonAction,
  GaugeArcFillStyle,
  GaugeDisplayStyle,
  GaugeWidgetConfig,
  GearWidgetConfig,
  ImageWidgetConfig,
  MapSwitchAction,
  NavigateAction,
  SensorIconName,
  SingleActionButtonConfig,
  TimerWidgetConfig,
  WarningWidgetConfig,
  Widget,
  WidgetConfig,
  WidgetType,
} from './widgets/index.js'

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

// dashboard.ts — Dashboard, Page, and Widget configuration types

import type { HexColor, WidgetType, WidgetLayout, WidgetStyle, SemVer } from './common'

// ---------------------------------------------------------------------------
// Known sensor icon identifiers (built-in icon set)
// Studio renders these as SVGs; firmware uses matching bitmaps from SPIFFS.
// ---------------------------------------------------------------------------

export type SensorIconName =
  | 'rpm'
  | 'speed'
  | 'coolant'
  | 'oil_pressure'
  | 'oil_temp'
  | 'battery'
  | 'fuel'
  | 'afr'
  | 'boost'
  | 'throttle'
  | 'iat'
  | 'gear'
  | 'timer'
  | 'warning'

// ---------------------------------------------------------------------------
// Widget config variants (discriminated union on `type`)
// ---------------------------------------------------------------------------

export interface GaugeWidgetConfig {
  type: 'gauge'
  minValue: number
  maxValue: number
  warningLevel: number
  dangerLevel: number
  showNeedle?: boolean
  showArc?: boolean
  /** Built-in sensor icon shown in the centre of the arc */
  iconName?: SensorIconName
}

export interface LabelWidgetConfig {
  type: 'label'
  decimalPlaces: number
  prefix?: string
  suffix?: string
  hideWhenInvalid?: boolean
  /** Icon displayed to the left of the value */
  iconName?: SensorIconName
}

export interface WarningWidgetConfig {
  type: 'warning'
  invertLogic?: boolean
  threshold: number
  /** Icon displayed inside the warning indicator */
  iconName?: SensorIconName
}

export interface ButtonWidgetConfig {
  type: 'button'
  targetPageId: string
  /** Text label shown on the button (can be combined with icon) */
  label: string
  /** Built-in sensor icon shown on the button */
  iconName?: SensorIconName
  /** Custom icon file from the asset library (overrides iconName) */
  iconPath?: string
  /** Controls what is rendered: icon only, label only, or both */
  showIcon?: boolean
  showLabel?: boolean
}

export interface TimerWidgetConfig {
  type: 'timer'
  autoStart?: boolean
  format?: 'mm:ss' | 'ss.mmm'
}

export interface BarWidgetConfig {
  type: 'bar'
  decimalPlaces: number
  prefix?: string
  suffix?: string
  /** Icon displayed at the start of the bar */
  iconName?: SensorIconName
}

export interface GearWidgetConfig {
  type: 'gear'
  decimalPlaces: 0
  prefix?: string
  suffix?: string
  hideWhenInvalid?: boolean
}

export interface ImageWidgetConfig {
  type: 'image'
  imagePath: string
}

export type WidgetConfig =
  | GaugeWidgetConfig
  | LabelWidgetConfig
  | WarningWidgetConfig
  | ButtonWidgetConfig
  | TimerWidgetConfig
  | BarWidgetConfig
  | GearWidgetConfig
  | ImageWidgetConfig

// ---------------------------------------------------------------------------
// Widget definition
// ---------------------------------------------------------------------------

export interface Widget {
  id: string
  type: WidgetType
  signal: string // Signal name key from signals.json
  layout: WidgetLayout
  style: WidgetStyle
  config: WidgetConfig
}

// ---------------------------------------------------------------------------
// Page definition
// ---------------------------------------------------------------------------

export interface PageConfig {
  id: string
  name: string
  backgroundImage: string | null
  backgroundColor: HexColor
  showTopBar: boolean
  widgets: Widget[]
}

// ---------------------------------------------------------------------------
// Top bar configuration
// ---------------------------------------------------------------------------

export interface TopBarConfig {
  height: number
  showMapName: boolean
  showMapProfile: boolean
  bgColor: HexColor
  textColor: HexColor
}

// ---------------------------------------------------------------------------
// Dashboard root configuration
// ---------------------------------------------------------------------------

export interface DashboardConfig {
  version: SemVer
  name: string
  description?: string
  defaultPageId: string
  revLimitRpm: number
  topBar: TopBarConfig
  pages: PageConfig[]
}

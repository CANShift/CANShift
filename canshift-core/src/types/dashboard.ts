// dashboard.ts — Dashboard, Page, and Widget configuration types

import type { HexColor, WidgetType, WidgetLayout, WidgetStyle, SemVer } from './common'

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
}

export interface LabelWidgetConfig {
  type: 'label'
  decimalPlaces: number
  prefix?: string
  suffix?: string
  hideWhenInvalid?: boolean
}

export interface WarningWidgetConfig {
  type: 'warning'
  invertLogic?: boolean
  threshold: number
}

export interface ButtonWidgetConfig {
  type: 'button'
  targetPageId: string
  label: string
  iconPath?: string
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
  id:       string
  type:     WidgetType
  signal:   string        // Signal name key from signals.json
  layout:   WidgetLayout
  style:    WidgetStyle
  config:   WidgetConfig
}

// ---------------------------------------------------------------------------
// Page definition
// ---------------------------------------------------------------------------

export interface PageConfig {
  id:              string
  name:            string
  backgroundImage: string | null
  backgroundColor: HexColor
  showTopBar:      boolean
  widgets:         Widget[]
}

// ---------------------------------------------------------------------------
// Top bar configuration
// ---------------------------------------------------------------------------

export interface TopBarConfig {
  height:         number
  showMapName:    boolean
  showMapProfile: boolean
  bgColor:        HexColor
  textColor:      HexColor
}

// ---------------------------------------------------------------------------
// Dashboard root configuration
// ---------------------------------------------------------------------------

export interface DashboardConfig {
  version:       SemVer
  name:          string
  description?:  string
  defaultPageId: string
  revLimitRpm:   number
  topBar:        TopBarConfig
  pages:         PageConfig[]
}

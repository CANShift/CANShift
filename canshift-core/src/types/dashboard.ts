// dashboard.ts — Dashboard, Page, and Widget configuration types

import type { HexColor, WidgetType, WidgetLayout, WidgetStyle, SemVer } from './common'

// ---------------------------------------------------------------------------
// Label position — used by gauge and bar widgets
// ---------------------------------------------------------------------------

export type WidgetLabelPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

// ---------------------------------------------------------------------------
// Known sensor icon identifiers (built-in icon set)
// Studio renders these as SVGs; firmware uses matching bitmaps from SPIFFS.
// ---------------------------------------------------------------------------

export type SensorIconName =
  // Existing sensors
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
  // Automotive controls & indicators
  | 'flame'
  | 'turbo'
  | 'engine'
  | 'brake'
  | 'launch'
  | 'traction'
  | 'map_icon'
  | 'exhaust'
  // Mechanical
  | 'cog'

// ---------------------------------------------------------------------------
// Widget config variants (discriminated union on `type`)
// ---------------------------------------------------------------------------

/** Visual presentation of a gauge widget */
export type GaugeDisplayStyle = 'numeric' | 'arc' | 'bar'

export interface GaugeWidgetConfig {
  type: 'gauge'
  /** How the value is rendered: plain number, semicircle arc, or vertical bar */
  displayStyle: GaugeDisplayStyle
  minValue: number
  maxValue: number
  warningLevel: number
  dangerLevel: number
  /** Decimal places for the numeric readout (all styles) */
  decimalPlaces: number
  prefix?: string
  suffix?: string
  hideWhenInvalid?: boolean
  /** Show needle pointer — arc style only */
  showNeedle?: boolean
  /** Icon shown in arc centre or beside numeric value */
  iconName?: SensorIconName
  /**
   * Flash the widget red when the signal value reaches revLimitRpm.
   * Firmware triggers a full-screen red blink; preview shows a red ring.
   */
  revFlash?: boolean
  /**
   * Orientation for the bar display style.
   * 'vertical' (default) = thermometer, 'horizontal' = progress bar.
   */
  barOrientation?: 'vertical' | 'horizontal'
  /** Short label shown at a fixed corner of the widget (e.g. "RPM", "Coolant") */
  label?: string
  labelPosition?: WidgetLabelPosition
}

export interface WarningWidgetConfig {
  type: 'warning'
  invertLogic?: boolean
  threshold: number
  /** Icon displayed inside the warning indicator */
  iconName?: SensorIconName
}

// ---------------------------------------------------------------------------
// Button action types — discriminated by category + type
// ---------------------------------------------------------------------------

/** Navigate to another dashboard page */
export interface NavigateAction {
  category: 'dashboard'
  type: 'navigate'
  pageId: string
}

/** Switch to a different UI theme */
export interface SetThemeAction {
  category: 'dashboard'
  type: 'set_theme'
  themeId: string
}

/**
 * Ask the ECU to switch to a specific map slot.
 * Requires a CAN output frame configured in MaxxECU.
 * Map index is 1-based (MaxxECU maps 1–8).
 * NOTE: CAN frame ID / encoding is ECU-specific and unverified.
 */
export interface MapSwitchAction {
  category: 'ecu'
  type: 'map_switch'
  mapIndex: number
}

/**
 * Send a raw CAN frame.
 * frameId: decimal or 0x-prefixed hex CAN ID
 * data: hex-encoded payload bytes, e.g. "0102030405060708"
 */
export interface CanRawAction {
  category: 'ecu'
  type: 'can_raw'
  frameId: number
  data: string
}

export type DashboardButtonAction = NavigateAction | SetThemeAction
export type EcuButtonAction = MapSwitchAction | CanRawAction
export type ButtonAction = DashboardButtonAction | EcuButtonAction

// ---------------------------------------------------------------------------
// Button widget config
// ---------------------------------------------------------------------------

export interface ButtonWidgetConfig {
  type: 'button'
  /** Text label shown on the button */
  label: string
  /** Built-in sensor icon shown on the button */
  iconName?: SensorIconName
  /** Custom icon file from the asset library (overrides iconName) */
  iconPath?: string
  /** Controls what is rendered: icon only, label only, or both */
  showIcon?: boolean
  showLabel?: boolean
  /**
   * When true, the button behaves as a toggle (stays active after press).
   * When false (default), it is momentary (active only while held).
   */
  isToggle?: boolean
  /**
   * Ordered list of actions to execute on press.
   * A button can have one or more actions, mixing ECU and dashboard types.
   */
  actions: ButtonAction[]
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
  /** Short label shown above or below the bar */
  label?: string
  labelPosition?: 'top-center' | 'bottom-center'
  /** Range bounds — auto-filled from signal definition on signal selection */
  minValue?: number
  maxValue?: number
  /** Optional thresholds — auto-filled from signal definition on signal selection */
  warningLevel?: number
  dangerLevel?: number
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
  /** When false, the page is hidden on the device (still editable in studio). Defaults to true. */
  visible?: boolean
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

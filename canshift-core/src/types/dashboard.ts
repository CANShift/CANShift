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

/**
 * Arc fill rendering mode (issue #175).
 * 'zones'    — legacy behaviour: warn/danger sector tinting on the background track.
 * 'gradient' — gray base arc + single value arc whose colour interpolates
 *              green → orange → red across [minValue, maxValue].
 * Arc display style only — ignored by 'numeric' and 'bar' display styles.
 */
export type GaugeArcFillStyle = 'zones' | 'gradient'

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
  /**
   * Arc fill rendering mode (issue #175). Defaults to 'zones' for backward
   * compatibility — existing arc gauges keep the warn/danger sector tinting.
   * Arc display style only — ignored by 'numeric' and 'bar'.
   */
  arcFillStyle?: GaugeArcFillStyle
  /**
   * Flash the widget red when the signal value reaches revLimitRpm.
   * Firmware triggers a full-screen red blink; preview shows a red ring.
   */
  revFlash?: boolean
  /**
   * Per-widget red flash threshold (issue #133). When the live value exceeds
   * this number, firmware pulses the widget red at ~1 Hz and renders the
   * value/label in white. Omit (or leave undefined) to disable.
   */
  alertThreshold?: number
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
  /** Short label shown at a fixed corner of the widget (e.g. "MIL", "Oil") */
  label?: string
  labelPosition?: WidgetLabelPosition
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

/**
 * Ask the ECU to switch to a specific map slot.
 * Requires a map-switch CAN output frame configured in your ECU.
 * Map index is 1-based. Frame ID and encoding are configured in signals.json.
 */
export interface MapSwitchAction {
  category: 'ecu'
  type: 'map_switch'
  mapIndex: number
}

/**
 * Send a raw CAN frame.
 * frameId: decimal or 0x-prefixed hex CAN ID. Standard 11-bit IDs cover the
 *   range [0, 0x7FF]; values above that require the extended (29-bit) frame
 *   format and are valid up to 0x1FFFFFFF.
 * data: hex-encoded payload bytes, e.g. "0102030405060708".
 *   Must be even-length, contain only hex characters (0-9, a-f, A-F),
 *   and be at most 16 characters (8 bytes — the CAN 2.0 DLC ceiling).
 *   An empty string is allowed and represents a zero-byte frame.
 * extended: when true, transmit as a 29-bit extended ID frame (issue #319).
 *   Optional and defaults to false. Firmware auto-promotes to extended when
 *   `frameId > 0x7FF` so legacy configs without the flag still emit valid
 *   frames.
 */
export interface CanRawAction {
  category: 'ecu'
  type: 'can_raw'
  frameId: number
  data: string
  extended?: boolean
}

export type DashboardButtonAction = NavigateAction
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
   * Two-state button colour palette (issue #146):
   *   `normal` — idle background / outline / label tint
   *   `active` — pressed / hover / triggered state
   * Older configs without this field fall back to the legacy `widget.style`
   * colours; the 1.7→1.8 migration backfills these from the existing style.
   */
  colors?: {
    normal: HexColor
    active: HexColor
  }
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
  /** Short label shown at a fixed corner of the widget */
  label?: string
  labelPosition?: WidgetLabelPosition
}

export interface BarWidgetConfig {
  type: 'bar'
  decimalPlaces: number
  prefix?: string
  suffix?: string
  /** Short label shown above or below the bar */
  label?: string
  labelPosition?: 'top-center' | 'bottom-center'
  /** Range bounds — auto-filled from signal definition on signal selection */
  minValue?: number
  maxValue?: number
  /** Optional thresholds — auto-filled from signal definition on signal selection */
  warningLevel?: number
  dangerLevel?: number
  /** Per-widget red flash threshold (issue #133) — see GaugeWidgetConfig.alertThreshold */
  alertThreshold?: number
}

export interface GearWidgetConfig {
  type: 'gear'
  decimalPlaces: 0
  prefix?: string
  suffix?: string
  hideWhenInvalid?: boolean
  /** Short label shown at a fixed corner of the widget (e.g. "GEAR") */
  label?: string
  labelPosition?: WidgetLabelPosition
}

export interface ImageWidgetConfig {
  type: 'image'
  imagePath: string
  /** Short label shown at a fixed corner of the widget */
  label?: string
  labelPosition?: WidgetLabelPosition
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

/**
 * Per-page color palette.
 * Widgets on this page inherit these colors unless they override individually.
 */
export interface PagePalette {
  /** Widget surface / card background */
  surface: HexColor
  /** Primary accent — gauge arcs, bar fills, highlights */
  primary: HexColor
  /** Secondary accent */
  accent: HexColor
  /** Default widget text */
  text: HexColor
  /** Muted / secondary text */
  textDim: HexColor
  /** Warning threshold color */
  warning: HexColor
  /** Danger threshold color */
  danger: HexColor
  /** Normal / ok state color */
  success: HexColor
}

export const DEFAULT_PAGE_PALETTE: PagePalette = {
  surface: '#1E1E1E',
  primary: '#FF4444',
  accent: '#FF8800',
  text: '#FFFFFF',
  textDim: '#888888',
  warning: '#FF8800',
  danger: '#FF4444',
  success: '#00CC44',
}

// ---------------------------------------------------------------------------
// Theme preset — background color + widget palette for a complete theme
// ---------------------------------------------------------------------------

/**
 * A complete theme preset used for day/night mode.
 * Stored at the dashboard root so the device can switch modes without
 * re-burning the config.
 */
export interface ThemePreset {
  bgColor: HexColor
  palette: PagePalette
}

export interface PageConfig {
  id: string
  backgroundImage: string | null
  backgroundColor: HexColor
  /** Per-page color palette used by widgets */
  palette: PagePalette
  showTopBar: boolean
  /** When false, the page is hidden on the device (still editable in studio). Defaults to true. */
  visible?: boolean
  widgets: Widget[]
}

// ---------------------------------------------------------------------------
// Top bar configuration
// ---------------------------------------------------------------------------

export type TopBarItemPosition = 'left' | 'center' | 'right'

/**
 * Items that can appear in the top bar layout. The renderer (firmware or
 * studio preview) walks the array and emits one element per item, grouped
 * by `position` (left → center → right).
 */
export type TopBarItem =
  | { type: 'statusDot'; signal: string; position: TopBarItemPosition }
  | { type: 'label'; text: string; position: TopBarItemPosition }
  | { type: 'separator'; position: TopBarItemPosition }
  | { type: 'signal'; signal: string; format?: string; position: TopBarItemPosition }
  | { type: 'usbIcon'; position: TopBarItemPosition }
  | { type: 'themeToggle'; position: TopBarItemPosition }
  | { type: 'modeFlag'; signal: string; text: string; position: TopBarItemPosition }

export interface TopBarConfig {
  height: number
  bgColor: HexColor
  textColor: HexColor
  /**
   * Optional ordered list of items rendered in the top bar.
   * When absent, both firmware and studio preview fall back to the default
   * layout below — this keeps pre-1.5.0 configs working unchanged.
   */
  layout?: TopBarItem[]
}

/**
 * Default top bar layout — mirrors what the firmware and studio used to
 * render via hardcoded markup before 1.5.0. Used as fallback when a config
 * has no `topBar.layout` set.
 *
 * `signal: 'any'` on a statusDot lights it green when ANY signal in the
 * signal store has been received recently — used for the CAN-presence dot.
 */
export const DEFAULT_TOP_BAR_LAYOUT: TopBarItem[] = [
  { type: 'statusDot', signal: 'rpm', position: 'left' },
  { type: 'label', text: 'ECU', position: 'left' },
  { type: 'separator', position: 'left' },
  { type: 'label', text: 'CAN', position: 'left' },
  { type: 'statusDot', signal: 'any', position: 'left' },
  { type: 'signal', signal: 'battery_volts', format: '%.1fV', position: 'right' },
  { type: 'usbIcon', position: 'right' },
  { type: 'separator', position: 'right' },
  { type: 'themeToggle', position: 'right' },
]

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
  /**
   * Optional day-mode theme. When present, the device top bar shows a ☀/☾
   * toggle that switches between this theme and the per-page night palette.
   * The active mode is persisted in NVS and survives power cycles.
   */
  dayTheme?: ThemePreset
  pages: PageConfig[]
  /** Identifies the ECU profile used to build the signal map. Restored by Studio on connect. */
  ecuProfileKey?: string
}

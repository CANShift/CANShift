// index.ts — Public API of @tmbk/shared-core
//
// Only import from this barrel file in consuming projects.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type { HexColor, WidgetType, WidgetLayout, WidgetStyle, SemVer } from './types/common'

export type {
  // Dashboard
  DashboardConfig,
  PageConfig,
  PagePalette,
  Widget,
  TopBarConfig,
  TopBarItem,
  TopBarItemPosition,
  WidgetConfig,
  GaugeWidgetConfig,
  GaugeDisplayStyle,
  GaugeArcFillStyle,
  WarningWidgetConfig,
  ButtonWidgetConfig,
  TimerWidgetConfig,
  BarWidgetConfig,
  GearWidgetConfig,
  ImageWidgetConfig,
  SensorIconName,
  WidgetLabelPosition,
  ThemePreset,
  // Button actions
  ButtonAction,
  DashboardButtonAction,
  EcuButtonAction,
  NavigateAction,
  MapSwitchAction,
  CanRawAction,
} from './types/dashboard'

export {
  DEFAULT_PAGE_PALETTE,
  DEFAULT_TOP_BAR_LAYOUT,
  BUTTON_ACTION_TYPES,
  isNavigateAction,
  isMapSwitchAction,
  isCanRawAction,
} from './types/dashboard'
export type {
  SignalConfig,
  SignalDef,
  ColorRamp,
  ColorRampStop,
  RampInterpolation,
} from './types/signal'
export type { DeviceConfig, CanSpeedKbps } from './types/device'
export { DEFAULT_DEVICE_CONFIG, CAN_SPEED_OPTIONS } from './types/device'

// Sensor color-ramp defaults (issue #430)
export {
  SENSOR_DEFAULT_RAMPS,
  resolveDefaultRamp,
  resolveSensorKind,
  colorAtValue,
} from './sensorDefaults'
export type { SensorKind } from './sensorDefaults'

// IPC return-shape contracts (renderer ↔ main)
export type { PortInfo, ConnectionStatus, UsbResult, OpenResult, SaveResult } from './types/ipc'

// GitHub release info (shared by studio + mobile — issue #571)
export type { ReleaseAsset, ReleaseInfo, LatestReleaseResult } from './types/releases'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
export { validateDashboard } from './validation/validate-dashboard'
export type { ValidationResult, ValidateDashboardOptions } from './validation/validate-dashboard'

// ---------------------------------------------------------------------------
// Firmware caps & limits
// ---------------------------------------------------------------------------
export {
  FIRMWARE_CAPS,
  CANVAS,
  TOPBAR_HEIGHT,
  REV_LIMIT_RPM,
  DECIMAL_PLACES,
  HEX_COLOR_REGEX,
  MAX_RAMP_STOPS,
} from './constants/firmware-caps'

// ---------------------------------------------------------------------------
// TopBar proportion table — shared with firmware (mirrored in top_bar.cpp)
// ---------------------------------------------------------------------------
export { TopBarMetrics } from './topbar-metrics'
export type { TopBarMetricsRatios } from './topbar-metrics'

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------
export {
  BUILTIN_MIGRATIONS,
  migrateConfig,
  validateMigrationChain,
} from './migrations/migration-runner'
export type {
  Migration,
  MigrationFn,
  MigrationRegistry,
  MigrationResult,
} from './migrations/migration-runner'

// ---------------------------------------------------------------------------
// Design tokens — canonical UI palette/spacing/typography (issue #526)
// ---------------------------------------------------------------------------
export type { DesignTokens } from './design-tokens'
// LIGHT_TOKENS deliberately not re-exported — placeholder values for the
// on-hold theme editor (#21), kept internal until a real consumer lands.
export { DARK_TOKENS, tokensToCssVars } from './design-tokens'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Current schema version — configs written by this version will have this. */
export const CURRENT_SCHEMA_VERSION = '1.14.0' as const

/** Display name of this product */
export const PRODUCT_NAME = 'CANShift' as const

// ---------------------------------------------------------------------------
// ECU profiles — built-in signal presets (issue #570)
// ---------------------------------------------------------------------------
export type { EcuProfile } from './ecu-profiles'
export { ECU_PROFILES, DEFAULT_PROFILE_ID } from './ecu-profiles'

// ---------------------------------------------------------------------------
// RealDash CAN XML import (issue #609)
// ---------------------------------------------------------------------------
export type { ParseRealDashXMLResult } from './realdash/parse-realdash-xml'
export { parseRealDashXML } from './realdash/parse-realdash-xml'

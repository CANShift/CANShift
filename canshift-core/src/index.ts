// index.ts — Public API of @tmbk/shared-core
//
// Only import from this barrel file in consuming projects.

// ---------------------------------------------------------------------------
// Types — all derived from Zod schemas; the schema file is the single source
// of truth. The intermediate `./types/*` barrels were removed in #914 — there
// is exactly one home for every contract now.
// ---------------------------------------------------------------------------
export type { HexColor, WidgetType, WidgetLayout, WidgetStyle, SemVer } from './schemas/common.js'

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
  CruiseControlAction,
  CruiseControlOp,
} from './schemas/dashboard.js'

export { DEFAULT_PAGE_PALETTE, DEFAULT_TOP_BAR_LAYOUT } from './schemas/dashboard.js'
// Button-action discriminator helpers — exposed because studio's ActionRow
// (#852) consumes them in `editor/ButtonActionEditor.tsx`. The previous
// "kept internal until needed" comment (referencing #793) is no longer
// accurate now that the studio editor ships.
export {
  BUTTON_ACTION_TYPES,
  CRUISE_CONTROL_OPS,
  isNavigateAction,
  isMapSwitchAction,
  isCanRawAction,
  isCruiseControlAction,
} from './schemas/dashboard.js'
export type {
  SignalConfig,
  SignalDef,
  ColorRamp,
  ColorRampStop,
  RampInterpolation,
} from './schemas/signal.js'
export type { DeviceConfig } from './schemas/device.js'
export type { CanSpeedKbps } from './schemas/signal.js'
export { CAN_SPEED_OPTIONS } from './schemas/signal.js'
export { DEFAULT_DEVICE_CONFIG } from './schemas/device.js'
export type { DeviceConfigWire } from './schemas/device.js'
export { deviceConfigFromWire, deviceConfigToWire } from './schemas/device.js'

// Input bindings — physical GPIO buttons → dashboard actions (issue #833)
export type {
  InputBinding,
  InputBindingWire,
  InputBindingsConfig,
  InputBindingsConfigWire,
  InputActiveLevel,
  InputPressKind,
} from './schemas/input-bindings'
export {
  InputBindingSchema,
  InputBindingsConfigSchema,
  InputBindingWireSchema,
  InputBindingsConfigWireSchema,
  inputBindingsFromWire,
  inputBindingsToWire,
  MAX_INPUT_BINDINGS,
  INPUT_BINDING_ID_MAX_LEN,
} from './schemas/input-bindings'

// Track-mode telemetry — BLE message contract between mobile and firmware (issue #843)
export type { TrackTelemetry } from './schemas/track-telemetry'
export { TrackTelemetrySchema } from './schemas/track-telemetry'

// BLE STATUS characteristic — firmware → mobile health/config payload (issue #887)
export type { BleStatusWire, BleStatus } from './schemas/ble-status'
export {
  BleStatusWireSchema,
  BLE_STATUS_MAX_STRING_LEN,
  bleStatusFromWire,
  parseBleStatus,
} from './schemas/ble-status'

// Sensor color-ramp defaults (issue #430)
export {
  SENSOR_DEFAULT_RAMPS,
  resolveDefaultRamp,
  resolveSensorKind,
  colorAtValue,
} from './sensorDefaults'
export type { SensorKind } from './sensorDefaults'

// Sensor semantic two-zone palette (issue #954)
export { SENSOR_PALETTE, sensorOkColor, sensorWarningColor } from './sensor-palette'
export type { SensorPaletteEntry } from './sensor-palette'

// GitHub release info (shared by studio + mobile — issue #571)
export type { ReleaseAsset, ReleaseInfo, LatestReleaseResult } from './types/releases'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
export { validateDashboard } from './validation/validate-dashboard'
export type { ValidationResult, ValidateDashboardOptions } from './validation/validate-dashboard'
export { validateSignalConfig } from './validation/validate-signal-config'
export { validateSignalCatalog } from './validation/validate-signal'

// ---------------------------------------------------------------------------
// Zod schemas (issue #673) — runtime source of truth for Dashboard, Signal,
// and ButtonAction. Type aliases above are derived from these via `z.infer`.
//
// Only the schemas actually consumed by downstream packages are re-exported.
// Sub-schemas (Page, Widget, TopBar, Signal*, ColorRamp, …) remain internal
// to keep the public API surface narrow (#771). Add a re-export here when a
// real consumer needs runtime parsing on the boundary.
// ---------------------------------------------------------------------------
export { DashboardConfigSchema } from './schemas/dashboard'
export { SignalConfigSchema } from './schemas/signal'
export {
  DeviceConfigSchema,
  DeviceConfigWireSchema,
  Esp32OutputGpioSchema,
  Esp32InputGpioSchema,
} from './schemas/device'

// Hardware profiles (#831) — per-board reserved/expansion pin tables that
// studio's pin pickers consume to surface only board-safe choices.
export { HARDWARE_PROFILES, isPinAvailableForBoard } from './schemas/hardware-profile'
export type { HardwareProfileId, HardwareProfile } from './schemas/hardware-profile'

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
// TopBar status colours — shared with firmware (mirrored in top_bar.cpp)
// ---------------------------------------------------------------------------
export { TopBarColors } from './topbar-colors'
export type { TopBarColorPalette } from './topbar-colors'

// ---------------------------------------------------------------------------
// Day-theme defaults — fallback palette + bg consumed by the studio canvas
// (and eventually the mobile renderer) when `dayTheme` is absent. Issue #901.
// ---------------------------------------------------------------------------
export { DAY_PALETTE_DEFAULT, DAY_BG_DEFAULT, DAY_THEME_PRESET } from './day-theme-defaults'

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
export const CURRENT_SCHEMA_VERSION = '1.17.0' as const

/** Display name of this product */
export const PRODUCT_NAME = 'CANShift' as const

// ---------------------------------------------------------------------------
// ECU profiles — built-in signal presets (issue #570)
// ---------------------------------------------------------------------------
export type { EcuProfile } from './ecu-profiles'
export { ECU_PROFILES, DEFAULT_PROFILE_ID, MAXXECU_SIGNAL_UNITS } from './ecu-profiles'

// ---------------------------------------------------------------------------
// RealDash CAN XML import (issue #609)
// ---------------------------------------------------------------------------
export type { ParseRealDashXMLResult } from './realdash/parse-realdash-xml'
export { parseRealDashXML } from './realdash/parse-realdash-xml'

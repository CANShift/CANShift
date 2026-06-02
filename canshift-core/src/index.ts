// index.ts — Public API of @tmbk/shared-core
//
// Only import from this barrel file in consuming projects.

// ---------------------------------------------------------------------------
// Types — all derived from Zod schemas; the schema file is the single source
// of truth. The intermediate `./types/*` barrels were removed in #914 — there
// is exactly one home for every contract now.
// ---------------------------------------------------------------------------
export type { HexColor, WidgetLayout, WidgetStyle, SemVer } from './schemas/common.js'

export type {
  // Dashboard
  DashboardConfig,
  PageConfig,
  PagePalette,
  PageTemplate,
  Widget,
  WidgetType,
  TopBarConfig,
  // (ScreenProfile / ScreenProfileId are exported from screen-profile.js — see below)
  TopBarItem,
  TopBarItemPosition,
  WidgetConfig,
  GaugeWidgetConfig,
  GaugeDisplayStyle,
  GaugeArcFillStyle,
  WarningWidgetConfig,
  ButtonWidgetConfig,
  TimerWidgetConfig,
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
// Cruise-control op tuple — single source of truth for the studio editor
// (`property-panel/button-fields.tsx`) and the device input-bindings UI
// (`device/InputBindingsSection.tsx`). Issue #1016 — replaces the previous
// per-file `CRUISE_OPS` copies. The `BUTTON_ACTION_TYPES` tuple and
// `is{Navigate,MapSwitch,CanRaw,CruiseControl}Action` type guards were
// dropped in the same pass — no non-test consumers found.
export { CRUISE_CONTROL_OPS } from './schemas/dashboard.js'
// Page template enum + tuple — drives the studio editor's template picker and
// the firmware page builder's procedural-layout branch (issue #451).
export { PAGE_TEMPLATES, PageTemplateSchema } from './schemas/dashboard.js'
export type {
  SignalConfig,
  SignalDef,
  ColorRamp,
  ColorRampStop,
  RampInterpolation,
} from './schemas/signal.js'

// OBD-II polling configuration (issue #841 — phase 3 of #556). Optional
// per-signal block that flips a signal from passive broadcast to active
// request/response. v1 ships Mode 01 + single ECU at 0x7DF/0x7E8.
export type { Obd2Mode, Obd2Pid, Obd2Polling } from './schemas/obd2.js'
export {
  Obd2ModeSchema,
  Obd2PidSchema,
  Obd2PollingSchema,
  OBD2_MIN_INTERVAL_MS,
  OBD2_MAX_INTERVAL_MS,
  OBD2_DEFAULT_INTERVAL_MS,
} from './schemas/obd2.js'
// Standard J1979 Mode 01 PID catalog — drives the studio editor's PID picker
// (issue #841). Firmware ignores this; it just reuses the per-signal decode
// fields the editor writes into SignalDef.
export type { Obd2Mode01PidEntry } from './ecu-profiles/obd2-mode01-pids.js'
export {
  OBD2_MODE01_PIDS,
  OBD2_REQUEST_FRAME_ID,
  OBD2_RESPONSE_FRAME_ID,
  obd2PidLookup,
} from './ecu-profiles/obd2-mode01-pids.js'
export type { DeviceConfig } from './schemas/device.js'
export type { CanSpeedKbps } from './schemas/signal.js'
export { CAN_SPEED_OPTIONS } from './schemas/signal.js'
export { DEFAULT_DEVICE_CONFIG } from './schemas/device.js'
export { deviceConfigFromWire, deviceConfigToWire } from './schemas/device.js'

// Input bindings — physical GPIO buttons → dashboard actions (issue #833)
export type {
  InputBinding,
  InputBindingsConfig,
  InputActiveLevel,
  InputPressKind,
} from './schemas/input-bindings.js'
export {
  InputBindingsConfigSchema,
  InputBindingsConfigWireSchema,
  inputBindingsFromWire,
  inputBindingsToWire,
  MAX_INPUT_BINDINGS,
  INPUT_BINDING_ID_MAX_LEN,
} from './schemas/input-bindings.js'

// Track-mode telemetry — BLE message contract between mobile and firmware (issue #843)
export type { TrackTelemetry } from './schemas/track-telemetry.js'
export { TrackTelemetrySchema } from './schemas/track-telemetry.js'

// Screen settings — CMD_SCREEN_SETTINGS / BLE SETTINGS payload (issue #1015, S-H-1)
export type { ScreenSettings } from './schemas/screen-settings.js'
export { ScreenSettingsSchema, SCREEN_SETTINGS_BOUNDS } from './schemas/screen-settings.js'

// BLE STATUS characteristic — firmware → mobile health/config payload (issue #887)
export type { BleStatus, BleStatusResult } from './schemas/ble-status.js'
export { BLE_STATUS_MAX_STRING_LEN, parseBleStatus } from './schemas/ble-status.js'

// Sensor color-ramp defaults (issue #430)
export {
  SENSOR_DEFAULT_RAMPS,
  resolveDefaultRamp,
  resolveSensorKind,
  colorAtValue,
} from './sensor-defaults.js'
export type { SensorKind } from './sensor-defaults.js'

// Sensor semantic two-zone palette (issue #954)
export { SENSOR_PALETTE, sensorOkColor, sensorWarningColor } from './sensor-palette.js'
export { signalTypeOkColor, signalTypeWarningColor } from './sensor-palette.js'
export type { SensorPaletteEntry } from './sensor-palette.js'

// Signal semantic type — drives the palette every widget bound to a signal
// uses for its zone fills and danger flash. Decoupled from per-widget icon.
export { SIGNAL_TYPES, SignalTypeSchema, DEFAULT_SIGNAL_TYPE } from './schemas/signal-type.js'
export type { SignalType } from './schemas/signal-type.js'

// GitHub release info (shared by studio + mobile — issue #571)
export type { ReleaseAsset, ReleaseInfo, LatestReleaseResult } from './types/releases.js'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
export { validateDashboard } from './validation/validate-dashboard.js'
export type { ValidationResult, ValidateDashboardOptions } from './validation/validate-dashboard.js'
export { validateSignalConfig } from './validation/validate-signal-config.js'

// ---------------------------------------------------------------------------
// Zod schemas (issue #673) — runtime source of truth for Dashboard, Signal,
// and ButtonAction. Type aliases above are derived from these via `z.infer`.
//
// Only the schemas actually consumed by downstream packages are re-exported.
// Sub-schemas (Page, Widget, TopBar, Signal*, ColorRamp, …) remain internal
// to keep the public API surface narrow (#771). Add a re-export here when a
// real consumer needs runtime parsing on the boundary.
// ---------------------------------------------------------------------------
export { DashboardConfigSchema } from './schemas/dashboard.js'
export { SignalConfigSchema } from './schemas/signal.js'
export {
  DeviceConfigSchema,
  DeviceConfigWireSchema,
  Esp32OutputGpioSchema,
  Esp32InputGpioSchema,
  SAFE_OUTPUT_PINS_WROOM32,
  SAFE_INPUT_PINS_WROOM32,
} from './schemas/device.js'

// Hardware profiles (#831) — per-board reserved/expansion pin tables that
// studio's pin pickers consume to surface only board-safe choices.
export { HARDWARE_PROFILES, isPinAvailableForBoard } from './schemas/hardware-profile.js'
export type { HardwareProfileId, HardwareProfile } from './schemas/hardware-profile.js'

// Target screen profiles (#548) — catalog + schema for the LCD a dashboard
// was authored against. Drives studio canvas dimensions and the future
// firmware multi-board / multi-screen paths (#17, #18). v1 ships a single
// profile (`crowpanel-28`); the field on DashboardConfig is optional and
// defaults to this profile for backward compatibility.
export {
  SCREEN_PROFILES,
  DEFAULT_SCREEN_PROFILE_ID,
  ScreenProfileSchema,
  ScreenProfileIdSchema,
  getScreenProfile,
  resolveScreenProfile,
} from './schemas/screen-profile.js'
export type { ScreenProfile, ScreenProfileId } from './schemas/screen-profile.js'

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
} from './constants/firmware-caps.js'

// ---------------------------------------------------------------------------
// TopBar proportion table — shared with firmware (mirrored in top_bar.cpp)
// ---------------------------------------------------------------------------
export { TopBarMetrics } from './topbar-metrics.js'
export type { TopBarMetricsRatios } from './topbar-metrics.js'

// ---------------------------------------------------------------------------
// TopBar status colours — shared with firmware (mirrored in top_bar.cpp)
// ---------------------------------------------------------------------------
export { TopBarColors } from './topbar-colors.js'
export type { TopBarColorPalette } from './topbar-colors.js'

// ---------------------------------------------------------------------------
// Day-theme defaults — fallback palette + bg consumed by the studio canvas
// (and eventually the mobile renderer) when `dayTheme` is absent. Issue #901.
// ---------------------------------------------------------------------------
export { DAY_PALETTE_DEFAULT, DAY_BG_DEFAULT, DAY_THEME_PRESET } from './day-theme-defaults.js'

// ---------------------------------------------------------------------------
// Night-theme defaults — fallback palette + bg consumed by the studio canvas
// when `nightTheme` is absent. Issue #21 v2 — mirror of the day defaults.
// ---------------------------------------------------------------------------
export {
  NIGHT_PALETTE_DEFAULT,
  NIGHT_BG_DEFAULT,
  NIGHT_THEME_PRESET,
} from './night-theme-defaults.js'

// ---------------------------------------------------------------------------
// Theme presets — named catalog the studio picker drops into dayTheme or
// nightTheme in one click. Issue #21 v2.
// ---------------------------------------------------------------------------
export { THEME_PRESETS, getThemePreset } from './theme-presets.js'
export type { ThemePresetEntry, ThemePresetId } from './theme-presets.js'

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------
export {
  BUILTIN_MIGRATIONS,
  migrateConfig,
  validateMigrationChain,
} from './migrations/migration-runner.js'
export type {
  Migration,
  MigrationFn,
  MigrationRegistry,
  MigrationResult,
} from './migrations/migration-runner.js'

// ---------------------------------------------------------------------------
// Design tokens — canonical UI palette/spacing/typography (issue #526)
// ---------------------------------------------------------------------------
export type { DesignTokens } from './design-tokens.js'
// LIGHT_TOKENS deliberately not re-exported — placeholder values for the
// on-hold theme editor (#21), kept internal until a real consumer lands.
export { COLOR_KEY_TO_CSS_VAR, DARK_TOKENS, tokensToCssVars } from './design-tokens.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Current schema version — configs written by this version will have this. */
export const CURRENT_SCHEMA_VERSION = '1.21.0' as const

/** Display name of this product */
export const PRODUCT_NAME = 'CANShift' as const

// ---------------------------------------------------------------------------
// ECU profiles — built-in signal presets (issue #570)
// ---------------------------------------------------------------------------
export type { EcuProfile } from './ecu-profiles/index.js'
export { ECU_PROFILES, DEFAULT_PROFILE_ID, MAXXECU_SIGNAL_UNITS } from './ecu-profiles/index.js'

// ---------------------------------------------------------------------------
// RealDash CAN XML import (issue #609)
// ---------------------------------------------------------------------------
export type { ParseRealDashXMLResult } from './realdash/parse-realdash-xml.js'
export { parseRealDashXML } from './realdash/parse-realdash-xml.js'

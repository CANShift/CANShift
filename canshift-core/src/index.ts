export type { HexColor, WidgetLayout, WidgetStyle, SemVer } from './schemas/common.js'
export { HexColorSchema } from './schemas/common.js'

export type {
  DashboardConfig,
  PageConfig,
  PagePalette,
  PageTemplate,
  Widget,
  WidgetType,
  TopBarConfig,
  TopBarItem,
  TopBarItemPosition,
  WidgetConfig,
  GaugeWidgetConfig,
  GaugeDisplayStyle,
  GaugeArcFillStyle,
  WarningWidgetConfig,
  ButtonWidgetConfig,
  SingleActionButtonConfig,
  CycleButtonConfig,
  CycleButtonState,
  TimerWidgetConfig,
  GearWidgetConfig,
  ImageWidgetConfig,
  SensorIconName,
  ThemePreset,
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
export { CRUISE_CONTROL_OPS } from './schemas/dashboard.js'
export { MIN_CYCLE_STATES, MAX_CYCLE_STATES } from './schemas/dashboard.js'
export { PAGE_TEMPLATES, PageTemplateSchema } from './schemas/dashboard.js'
export type {
  SignalConfig,
  SignalDef,
  ColorRamp,
  ColorRampStop,
  RampInterpolation,
  OutboundCanSignal,
} from './schemas/signal.js'

export type { Obd2Mode, Obd2Pid, Obd2Polling } from './schemas/obd2.js'
export {
  Obd2ModeSchema,
  Obd2PidSchema,
  Obd2PollingSchema,
  OBD2_MIN_INTERVAL_MS,
  OBD2_MAX_INTERVAL_MS,
  OBD2_DEFAULT_INTERVAL_MS,
} from './schemas/obd2.js'
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

export type { TrackTelemetry } from './schemas/track-telemetry.js'
export { TrackTelemetrySchema } from './schemas/track-telemetry.js'

export type { ScreenSettings } from './schemas/screen-settings.js'
export { ScreenSettingsSchema, SCREEN_SETTINGS_BOUNDS } from './schemas/screen-settings.js'

export type { BleStatus, BleStatusResult } from './schemas/ble-status.js'
export { BLE_STATUS_MAX_STRING_LEN, parseBleStatus } from './schemas/ble-status.js'

export type {
  LogFrame,
  CanFrame,
  TeleFrame,
  HeapStatsFrame,
  HeapStatsFrameWire,
} from './schemas/ws-frames.js'
export {
  LogFrameSchema,
  CanFrameSchema,
  TeleFrameSchema,
  HeapStatsFrameWireSchema,
  heapStatsFromWire,
} from './schemas/ws-frames.js'

export {
  SENSOR_DEFAULT_RAMPS,
  resolveDefaultRamp,
  resolveSensorKind,
  colorAtValue,
} from './sensor-defaults.js'
export type { SensorKind } from './sensor-defaults.js'

export { SENSOR_PALETTE, sensorOkColor, sensorWarningColor } from './sensor-palette.js'
export { signalTypeOkColor, signalTypeWarningColor } from './sensor-palette.js'
export type { SensorPaletteEntry } from './sensor-palette.js'

export { SIGNAL_TYPES, SignalTypeSchema, DEFAULT_SIGNAL_TYPE } from './schemas/signal-type.js'
export type { SignalType } from './schemas/signal-type.js'

export type { ReleaseAsset, ReleaseInfo, LatestReleaseResult } from './types/releases.js'

export { validateDashboard } from './validation/validate-dashboard.js'
export type { ValidationResult, ValidateDashboardOptions } from './validation/validate-dashboard.js'
export { validateSignalConfig } from './validation/validate-signal-config.js'

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

export { HARDWARE_PROFILES, isPinAvailableForBoard } from './schemas/hardware-profile.js'
export type { HardwareProfileId, HardwareProfile } from './schemas/hardware-profile.js'

export {
  SCREEN_PROFILES,
  DEFAULT_SCREEN_PROFILE_ID,
  ScreenProfileSchema,
  ScreenProfileIdSchema,
  getScreenProfile,
  resolveScreenProfile,
} from './schemas/screen-profile.js'
export type { ScreenProfile, ScreenProfileId } from './schemas/screen-profile.js'

export {
  FIRMWARE_CAPS,
  CANVAS,
  TOPBAR_HEIGHT,
  REV_LIMIT_RPM,
  DECIMAL_PLACES,
  HEX_COLOR_REGEX,
  MAX_RAMP_STOPS,
} from './constants/firmware-caps.js'

export { TopBarMetrics } from './topbar-metrics.js'
export type { TopBarMetricsRatios } from './topbar-metrics.js'

export { TopBarColors } from './topbar-colors.js'
export type { TopBarColorPalette } from './topbar-colors.js'

export { DAY_PALETTE_DEFAULT, DAY_BG_DEFAULT, DAY_THEME_PRESET } from './day-theme-defaults.js'

export {
  NIGHT_PALETTE_DEFAULT,
  NIGHT_BG_DEFAULT,
  NIGHT_THEME_PRESET,
} from './night-theme-defaults.js'

export { THEME_PRESETS, getThemePreset } from './theme-presets.js'
export type { ThemePresetEntry, ThemePresetId } from './theme-presets.js'

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

export type { DesignTokens } from './design-tokens.js'
export { COLOR_KEY_TO_CSS_VAR, DARK_TOKENS, tokensToCssVars } from './design-tokens.js'

export const CURRENT_SCHEMA_VERSION = '1.23.0' as const

export const PRODUCT_NAME = 'CANShift' as const

export type { EcuProfile } from './ecu-profiles/index.js'
export { ECU_PROFILES, DEFAULT_PROFILE_ID, MAXXECU_SIGNAL_UNITS } from './ecu-profiles/index.js'

export type { ParseCanXmlResult } from './can-xml/parse-can-xml.js'
export { parseCanXml } from './can-xml/parse-can-xml.js'

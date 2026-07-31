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
export { OBD2_MODE01_PIDS, obd2PidLookup } from './ecu-profiles/obd2-mode01-pids.js'
export type { DeviceConfig } from './schemas/device.js'
export type { CanSpeedKbps, SignalByteLength } from './schemas/signal.js'
export { SIGNAL_BYTE_LENGTHS } from './schemas/signal.js'
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

export type { ScreenSettings, ScreenSettingsResult } from './schemas/screen-settings.js'
export {
  ScreenSettingsSchema,
  SCREEN_SETTINGS_BOUNDS,
  parseSettings,
} from './schemas/screen-settings.js'

export type { BleStatus, BleStatusResult } from './schemas/ble-status.js'
export { BLE_STATUS_MAX_STRING_LEN, parseBleStatus } from './schemas/ble-status.js'
export type {
  TimerBleLap,
  TimerBleState,
  TimerCommand,
  TimerCommandCode,
  TimerLapResult,
  TimerLapWire,
  TimerRunState,
  TimerStateResult,
  TimerStateWire,
} from './schemas/ble-timer.js'
export {
  TIMER_COMMAND_CODES,
  TIMER_LAP_BUFFER_CAPACITY,
  TIMER_RUN_STATES,
  TimerLapWireSchema,
  TimerStateWireSchema,
  encodeTimerCommand,
  parseTimerLap,
  parseTimerState,
  timerLapFromWire,
  timerStateFromWire,
} from './schemas/ble-timer.js'

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
  SENSOR_KINDS,
  SENSOR_KIND_TO_ICON,
  SENSOR_DEFAULT_RAMPS,
  colorAtValue,
} from './sensor-defaults.js'
export type { SensorKind } from './sensor-defaults.js'

export { SENSOR_PALETTE, sensorOkColor, sensorWarningColor } from './sensor-palette.js'
export type { SensorPaletteEntry } from './sensor-palette.js'

export { SIGNAL_TYPES, SignalTypeSchema } from './schemas/signal-type.js'
export type { SignalType } from './schemas/signal-type.js'

export type { ReleaseAsset, ReleaseInfo, LatestReleaseResult } from './types/releases.js'
export { ReleaseAssetSchema, ReleaseInfoSchema } from './types/releases.js'

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
  MAX_RAMP_STOPS,
} from './constants/firmware-caps.js'

export { TopBarMetrics } from './topbar-metrics.js'
export type { TopBarMetricsRatios } from './topbar-metrics.js'

export {
  WIDGET_ZONE_COLORS,
  WIDGET_TEXT_COLORS,
  WIDGET_STALE_TEXT_COLORS,
  widgetTextColor,
  widgetStaleTextColor,
  WIDGET_FONT_CLAMP,
  VALUE_FRAC_FONT_RATIO,
  VALUE_UNIT_FONT_SIZE,
  STALE_PLACEHOLDER,
  widgetFracFontSize,
  GAUGE_ARC,
  GAUGE_TRACK_COLORS,
  GAUGE_VALUE_FONT_BREAKPOINTS,
  gaugeValueFontSize,
  gaugeArcStrokeWidth,
  gaugeValueAngle,
  gaugeGradientColorAt,
  LABEL_FONT_RATIO,
  labelFontSize,
  GEAR_FONT_RATIO,
  gearFontSize,
  GEAR_NEUTRAL_GLYPH,
  GEAR_REVERSE_GLYPH,
  gearGlyph,
  WARNING_BLINK_PERIOD_MS,
  WARNING_BLINK_OPACITY,
  WARNING_IDLE_BG_OPACITY,
  WARNING_STALE_BORDER_WIDTH,
  WARNING_SIGNAL_LABEL_MIN_HEIGHT,
  isWarningTripped,
  TIMER_LONG_PRESS_MS,
  TIMER_BLINK_PERIOD_MS,
  TIMER_STATE_BORDER_WIDTH,
  TIMER_BORDER_COLORS,
  TIMER_FONT_BREAKPOINTS,
  timerFontSize,
  formatTimerMmSs,
  formatTimerSsMmm,
  SENSOR_DEFAULT_RANGES,
  sensorDefaultRange,
  SENSOR_DANGER_COLOR,
  sensorDefaultDangerThreshold,
} from './widget-metrics.js'
export type { SensorDangerThreshold } from './widget-metrics.js'

export { DAY_PALETTE_DEFAULT, DAY_BG_DEFAULT, DAY_THEME_PRESET } from './day-theme-defaults.js'

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

export type { DesignTokens, BrandTokens, BrandNeutralStep } from './design-tokens.js'
export {
  COLOR_KEY_TO_CSS_VAR,
  DARK_TOKENS,
  tokensToCssVars,
  BRAND_TOKENS,
  BRAND_NEUTRAL_STEPS,
  BRAND_COLOR_KEY_TO_CSS_VAR,
  BRAND_TEXT_CSS_VAR,
  BRAND_DIVIDER_CSS_VAR,
  brandNeutralCssVar,
  brandTokensToCssVars,
} from './design-tokens.js'

export const CURRENT_SCHEMA_VERSION = '1.24.0' as const

export type { EcuProfile } from './ecu-profiles/index.js'
export { ECU_PROFILES, DEFAULT_PROFILE_ID, MAXXECU_SIGNAL_UNITS } from './ecu-profiles/index.js'

export type { ParseCanXmlResult } from './can-xml/parse-can-xml.js'
export { parseCanXml } from './can-xml/parse-can-xml.js'
export type { EvalContext } from './can-xml/eval-expr.js'
export { compileExpr, evalExpr } from './can-xml/eval-expr.js'

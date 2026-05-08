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

export { DEFAULT_PAGE_PALETTE, DEFAULT_TOP_BAR_LAYOUT } from './types/dashboard'
export type { SignalConfig, SignalDef } from './types/signal'
export type { DeviceConfig, CanSpeedKbps } from './types/device'
export { DEFAULT_DEVICE_CONFIG, CAN_SPEED_OPTIONS } from './types/device'

// IPC return-shape contracts (renderer ↔ main)
export type { PortInfo, ConnectionStatus, UsbResult, OpenResult, SaveResult } from './types/ipc'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
export { validateDashboard } from './validation/validate-dashboard'
export type { ValidationResult, ValidateDashboardOptions } from './validation/validate-dashboard'
export { validateSignals } from './validation/validate-signals'
export { validateDevice } from './validation/validate-device'

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
// Constants
// ---------------------------------------------------------------------------

/** Current schema version — configs written by this version will have this. */
export const CURRENT_SCHEMA_VERSION = '1.11.0' as const

/** Display name of this product */
export const PRODUCT_NAME = 'CANShift' as const

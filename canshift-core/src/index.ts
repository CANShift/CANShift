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
  WidgetConfig,
  GaugeWidgetConfig,
  GaugeDisplayStyle,
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

export { DEFAULT_PAGE_PALETTE } from './types/dashboard'
export type { SignalConfig, SignalDef } from './types/signal'
export type { DeviceConfig, CanSpeedKbps } from './types/device'
export { DEFAULT_DEVICE_CONFIG, CAN_SPEED_OPTIONS } from './types/device'

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
export { validateDashboard } from './validation/validate-dashboard'
export type { ValidationResult } from './validation/validate-dashboard'

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------
export { migrateConfig } from './migrations/migration-runner'
export type { MigrationResult } from './migrations/migration-runner'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Current schema version — configs written by this version will have this. */
export const CURRENT_SCHEMA_VERSION = '1.4.0' as const

/** Display name of this product */
export const PRODUCT_NAME = 'CANShift' as const

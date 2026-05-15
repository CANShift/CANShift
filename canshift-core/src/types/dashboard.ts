// types/dashboard.ts — Re-exports of dashboard config types.
//
// Types listed here are now derived from Zod schemas in `../schemas/dashboard`
// per issue #673. The schema is the single source of truth; this barrel keeps
// the existing import paths working for the public API in `index.ts`.

export type {
  WidgetLabelPosition,
  SensorIconName,
  GaugeDisplayStyle,
  GaugeArcFillStyle,
  GaugeWidgetConfig,
  WarningWidgetConfig,
  NavigateAction,
  MapSwitchAction,
  CanRawAction,
  DashboardButtonAction,
  EcuButtonAction,
  ButtonAction,
  ButtonWidgetConfig,
  TimerWidgetConfig,
  BarWidgetConfig,
  GearWidgetConfig,
  ImageWidgetConfig,
  WidgetConfig,
  Widget,
  PagePalette,
  ThemePreset,
  PageConfig,
  TopBarItemPosition,
  TopBarItem,
  TopBarConfig,
  DashboardConfig,
} from '../schemas/dashboard.js'

export {
  DEFAULT_PAGE_PALETTE,
  DEFAULT_TOP_BAR_LAYOUT,
  BUTTON_ACTION_TYPES,
  isNavigateAction,
  isMapSwitchAction,
  isCanRawAction,
} from '../schemas/dashboard.js'

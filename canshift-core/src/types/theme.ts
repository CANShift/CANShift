// theme.ts — Theme configuration types

import type { HexColor, SemVer } from './common'

export interface Palette {
  background: HexColor
  surface:    HexColor
  primary:    HexColor
  accent:     HexColor
  text:       HexColor
  textDim:    HexColor
  warning:    HexColor
  danger:     HexColor
  success:    HexColor
  info?:      HexColor
}

export interface TopBarTheme {
  bg:   HexColor
  text: HexColor
}

export interface GaugeTheme {
  trackColor:   HexColor
  trackWidth:   number
  valueColor:   HexColor
  warningColor: HexColor
  dangerColor:  HexColor
  labelColor:   HexColor
}

export interface AlertTheme {
  revLimiterColor:   HexColor
  revLimiterOpacity: number   // 0-100
  warningBgColor:    HexColor
  criticalBgColor:   HexColor
}

/** Root theme configuration (theme.json) */
export interface ThemeConfig {
  version: SemVer
  name:    string
  mode:    'dark' | 'light'
  palette: Palette
  topBar:  TopBarTheme
  gauges?: GaugeTheme
  alerts?: AlertTheme
}

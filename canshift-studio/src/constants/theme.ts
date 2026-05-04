// theme.ts — Shared day-theme palette defaults used across Canvas and PropertyPanel.
//
// These values are the fallback "day mode" colors applied in the studio preview
// when config.dayTheme has not yet been configured. They intentionally mirror the
// defaults a user would see on a first-run device.

import type { PagePalette, ThemePreset } from '@tmbk/canshift-core'

/** Default palette for day (light) mode. Used when config.dayTheme is absent. */
export const DAY_PALETTE_DEFAULT: PagePalette = {
  surface: '#F0F0F0',
  primary: '#CC0000',
  accent: '#E06000',
  text: '#000000',
  textDim: '#444444',
  warning: '#CC6600',
  danger: '#CC0000',
  success: '#006622',
}

/** Default background color for day mode. */
export const DAY_BG_DEFAULT = '#DDDDDD' as const

/**
 * Full day-theme preset used as the initial value when the user clicks
 * "enable" in PropertyPanel — bundles palette + bg into one object.
 */
export const DAY_THEME_PRESET: ThemePreset = {
  bgColor: DAY_BG_DEFAULT,
  palette: DAY_PALETTE_DEFAULT,
}

// day-theme-defaults.ts — Built-in fallback palette + background for day mode.
//
// Used as the initial value when a dashboard's `dayTheme` field is absent and
// referenced by both the Studio canvas preview and (eventually) the mobile
// renderer when it grows day-mode support. Lives in canshift-core so every
// consumer pulls the same hex values — the previous Studio-local copy in
// the (now-decommissioned) Electron `canshift-studio/src/constants/theme.ts`
// drifted out of sync with the firmware whenever the renderer team tweaked a
// colour without updating the preview.
//
// Issue #901: share theme defaults across packages.

import { HexColorSchema } from './schemas/common.js'
import { PagePaletteSchema } from './schemas/dashboard.js'
import type { PagePalette, ThemePreset } from './schemas/dashboard.js'

/**
 * Default palette for day (light) mode. Used when config.dayTheme is absent.
 *
 * `.parse()` runs once at module load — the branded `HexColor` is nominal, so
 * literal hex strings need a runtime validator to acquire the brand. A typo
 * here trips Zod up front instead of producing a misleading firmware ack
 * downstream (#1207 brand follow-up to #1316).
 */
export const DAY_PALETTE_DEFAULT: PagePalette = PagePaletteSchema.parse({
  surface: '#F0F0F0',
  primary: '#CC0000',
  accent: '#E06000',
  text: '#000000',
  textDim: '#444444',
  warning: '#CC6600',
  danger: '#CC0000',
  success: '#006622',
})

/** Default background color for day mode. */
export const DAY_BG_DEFAULT = HexColorSchema.parse('#DDDDDD')

/**
 * Full day-theme preset used as the initial value when the user clicks
 * "enable" in the studio's property panel — bundles palette + bg into one
 * object so the consumer doesn't have to re-assemble both fields.
 */
export const DAY_THEME_PRESET: ThemePreset = {
  bgColor: DAY_BG_DEFAULT,
  palette: DAY_PALETTE_DEFAULT,
}

// night-theme-defaults.ts — Built-in fallback palette + background for night mode.
//
// Mirror of `day-theme-defaults.ts` for the night-mode side of the day/night
// pair the firmware toggles between (`theme_manager.cpp`). Used by the Studio
// canvas preview and (eventually) the firmware when it grows an explicit
// nightTheme reader — until then firmware keeps deriving night colours from
// each page's palette / backgroundColor, matching pre-#21 behaviour.
//
// Issue #21 v2.

import { HexColorSchema } from './schemas/common.js'
import { PagePaletteSchema } from './schemas/dashboard.js'
import type { PagePalette, ThemePreset } from './schemas/dashboard.js'

/**
 * Default palette for night (dark) mode. Used when config.nightTheme is absent.
 *
 * `.parse()` runs once at module load — the branded `HexColor` is nominal, so
 * literal hex strings need a runtime validator to acquire the brand. A typo
 * here trips Zod up front instead of producing a misleading firmware ack
 * downstream (#1207 brand follow-up to #1316).
 */
export const NIGHT_PALETTE_DEFAULT: PagePalette = PagePaletteSchema.parse({
  surface: '#1E1E1E',
  primary: '#FF4444',
  accent: '#FF8800',
  text: '#FFFFFF',
  textDim: '#888888',
  warning: '#FF8800',
  danger: '#FF4444',
  success: '#00CC44',
})

/** Default background color for night mode. */
export const NIGHT_BG_DEFAULT = HexColorSchema.parse('#000000')

/**
 * Full night-theme preset used as the initial value when the user clicks
 * "enable" in the studio's property panel — bundles palette + bg into one
 * object so the consumer doesn't have to re-assemble both fields.
 */
export const NIGHT_THEME_PRESET: ThemePreset = {
  bgColor: NIGHT_BG_DEFAULT,
  palette: NIGHT_PALETTE_DEFAULT,
}

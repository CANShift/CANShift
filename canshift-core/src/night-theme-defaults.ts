import { HexColorSchema } from './schemas/common.js'
import { PagePaletteSchema } from './schemas/dashboard.js'
import type { PagePalette, ThemePreset } from './schemas/dashboard.js'

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

export const NIGHT_BG_DEFAULT = HexColorSchema.parse('#000000')

export const NIGHT_THEME_PRESET: ThemePreset = {
  bgColor: NIGHT_BG_DEFAULT,
  palette: NIGHT_PALETTE_DEFAULT,
}

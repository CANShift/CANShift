import { ThemePresetSchema } from './schemas/dashboard.js'
import type { ThemePreset } from './schemas/dashboard.js'

export type ThemePresetId = 'default-dark' | 'high-contrast' | 'subtle'

export interface ThemePresetEntry {
  id: ThemePresetId
  label: string
  theme: ThemePreset
}

const themeFromLiterals = (theme: unknown): ThemePreset => ThemePresetSchema.parse(theme)

const DEFAULT_DARK: ThemePresetEntry = {
  id: 'default-dark',
  label: 'Default Dark',
  theme: themeFromLiterals({
    bgColor: '#000000',
    palette: {
      surface: '#1E1E1E',
      primary: '#FF4444',
      accent: '#FF8800',
      text: '#FFFFFF',
      textDim: '#888888',
      warning: '#FF8800',
      danger: '#FF4444',
      success: '#00CC44',
    },
  }),
}

const HIGH_CONTRAST: ThemePresetEntry = {
  id: 'high-contrast',
  label: 'High Contrast',
  theme: themeFromLiterals({
    bgColor: '#000000',
    palette: {
      surface: '#1A1A1A',
      primary: '#FF0000',
      accent: '#FFAA00',
      text: '#FFFFFF',
      textDim: '#CCCCCC',
      warning: '#FFAA00',
      danger: '#FF0000',
      success: '#00FF44',
    },
  }),
}

const SUBTLE: ThemePresetEntry = {
  id: 'subtle',
  label: 'Subtle',
  theme: themeFromLiterals({
    bgColor: '#0E0E0E',
    palette: {
      surface: '#222222',
      primary: '#CC5555',
      accent: '#CC8844',
      text: '#E8E8E8',
      textDim: '#888888',
      warning: '#CC8844',
      danger: '#CC5555',
      success: '#55AA55',
    },
  }),
}

export const THEME_PRESETS: readonly ThemePresetEntry[] = [
  DEFAULT_DARK,
  HIGH_CONTRAST,
  SUBTLE,
] as const

export const getThemePreset = (id: ThemePresetId): ThemePresetEntry | undefined =>
  THEME_PRESETS.find((p) => p.id === id)

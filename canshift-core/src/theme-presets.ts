// theme-presets.ts — Built-in catalog of named dashboard themes (#21 v2).
//
// Each entry is a `ThemePreset` (background + palette) that the studio
// "Apply preset" picker can drop into either `dayTheme` or `nightTheme` in
// one click. The catalog is intentionally small (3 entries) — enough to show
// the picker UI off without becoming a maintenance hazard. New presets are
// just additional entries in `THEME_PRESETS`; downstream consumers iterate
// the array and never hard-code an id.

import type { ThemePreset } from './schemas/dashboard.js'

/** Stable identifier used by the studio picker — kebab-case, no spaces. */
export type ThemePresetId = 'default-dark' | 'high-contrast' | 'subtle'

export interface ThemePresetEntry {
  /** Stable id — drives the picker value + diff-friendly serialization. */
  id: ThemePresetId
  /** Display label shown in the picker. Kept here (not localized) for v1. */
  label: string
  /** The actual theme payload applied when the user picks this entry. */
  theme: ThemePreset
}

// "Default Dark" — current night-mode defaults frozen as a preset. Picking it
// is equivalent to the "Reset to default" button on the night-theme editor.
const DEFAULT_DARK: ThemePresetEntry = {
  id: 'default-dark',
  label: 'Default Dark',
  theme: {
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
  },
}

// "High Contrast" — boosted reds + brighter text for visibility under direct
// sunlight or low-vision setups. Picked so the dim text is still readable
// (#CCCCCC instead of #888888) without going pure-white.
const HIGH_CONTRAST: ThemePresetEntry = {
  id: 'high-contrast',
  label: 'High Contrast',
  theme: {
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
  },
}

// "Subtle" — lower-saturation palette that takes the edge off a long night
// drive. Surface lifts off pure black so widget borders are still legible,
// reds dim to a coral, accent shifts toward amber.
const SUBTLE: ThemePresetEntry = {
  id: 'subtle',
  label: 'Subtle',
  theme: {
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
  },
}

/**
 * Public catalog — ordered, immutable. Studio iterates this array to build
 * the picker; firmware never sees these (presets resolve to a `ThemePreset`
 * payload at picker time, which is what gets written into `dayTheme` /
 * `nightTheme` and shipped to the device).
 */
export const THEME_PRESETS: readonly ThemePresetEntry[] = [
  DEFAULT_DARK,
  HIGH_CONTRAST,
  SUBTLE,
] as const

/** Lookup by id — returns `undefined` for an unknown id. */
export function getThemePreset(id: ThemePresetId): ThemePresetEntry | undefined {
  return THEME_PRESETS.find((p) => p.id === id)
}

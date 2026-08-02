import { HexColorSchema } from './schemas/common.js'
import { DEFAULT_PAGE_PALETTE, PagePaletteSchema } from './schemas/dashboard.js'
import type { ThemePreset } from './schemas/dashboard.js'
import { DAY_BG_DEFAULT, DAY_PALETTE_DEFAULT } from './day-theme-defaults.js'

export interface ThemePresetEntry {
  id: string
  label: string
  note: string
  preset: ThemePreset
}

const entry = (
  id: string,
  label: string,
  note: string,
  bgColor: string,
  palette: {
    surface: string
    primary: string
    accent: string
    text: string
    textDim: string
    warning: string
    danger: string
    success: string
  }
): ThemePresetEntry => ({
  id,
  label,
  note,
  preset: {
    bgColor: HexColorSchema.parse(bgColor),
    palette: PagePaletteSchema.parse(palette),
  },
})

export const THEME_PRESETS: readonly ThemePresetEntry[] = [
  {
    id: 'night',
    label: 'Night',
    note: 'default',
    preset: { bgColor: HexColorSchema.parse('#121212'), palette: DEFAULT_PAGE_PALETTE },
  },
  {
    id: 'day',
    label: 'Day',
    note: 'auto at sunrise',
    preset: { bgColor: DAY_BG_DEFAULT, palette: DAY_PALETTE_DEFAULT },
  },
  entry('endurance', 'Endurance', 'dim — night stints', '#080808', {
    surface: '#141414',
    primary: '#CC3333',
    accent: '#7A4A00',
    text: '#8F8F8F',
    textDim: '#5A5A5A',
    warning: '#7A4A00',
    danger: '#CC3333',
    success: '#2E7D32',
  }),
  entry('rally', 'Rally', 'amber, high glare', '#101010', {
    surface: '#1C1A16',
    primary: '#FF4444',
    accent: '#FF8800',
    text: '#FFC24D',
    textDim: '#8A7A55',
    warning: '#FF8800',
    danger: '#FF4444',
    success: '#00CC44',
  }),
  entry('drag', 'Drag', 'mono, max contrast', '#000000', {
    surface: '#0D0D0D',
    primary: '#FF0000',
    accent: '#FFFFFF',
    text: '#FFFFFF',
    textDim: '#7A7A7A',
    warning: '#FF8800',
    danger: '#FF0000',
    success: '#00CC44',
  }),
  entry('circuit', 'Circuit', 'CANShift red', '#121212', {
    surface: '#1F1616',
    primary: '#FF4747',
    accent: '#FF4747',
    text: '#FFFFFF',
    textDim: '#B08A8A',
    warning: '#FF8800',
    danger: '#FF4747',
    success: '#00CC44',
  }),
  entry('ice', 'Ice', 'cold, low fatigue', '#0B0F12', {
    surface: '#141A1F',
    primary: '#FF5A5A',
    accent: '#4FC3F7',
    text: '#DCEAF2',
    textDim: '#7C939F',
    warning: '#FF8800',
    danger: '#FF5A5A',
    success: '#00CC44',
  }),
  entry('paper', 'Paper', 'daylight, reflective', '#E8E6E1', {
    surface: '#F5F3EF',
    primary: '#C41200',
    accent: '#B35C00',
    text: '#141414',
    textDim: '#6A665F',
    warning: '#B35C00',
    danger: '#C41200',
    success: '#006622',
  }),
]

export const themePresetById = (id: string): ThemePresetEntry | undefined =>
  THEME_PRESETS.find((t) => t.id === id)

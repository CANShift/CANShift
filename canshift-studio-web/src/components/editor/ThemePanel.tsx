// ThemePanel.tsx — Editor for the dashboard's day + night themes (#21 v2).
//
// Lives next to PropertyPanel in the editor sidebar. The panel has its own
// day/night toggle (the user is *editing* whichever side is active) — this is
// deliberately decoupled from the canvas "Preview as" toggle so the user can
// edit day while previewing night, or vice versa.
//
// Top of the panel:
//   - Day / Night tab — pick which theme you're editing
//   - "Apply preset" dropdown — drops a built-in preset into the active theme
//   - Copy day → night / Copy night → day — handy for symmetric setups
//   - Reset — restores the built-in default for the active theme
//
// Color edits flow back through the dashboard store's `setDayTheme` /
// `setNightTheme` so they participate in undo / redo and dirty-tracking.

import type { PagePalette, ThemePreset, ThemePresetId } from '@tmbk/canshift-core'
import {
  DAY_BG_DEFAULT,
  DAY_PALETTE_DEFAULT,
  DAY_THEME_PRESET,
  NIGHT_BG_DEFAULT,
  NIGHT_PALETTE_DEFAULT,
  NIGHT_THEME_PRESET,
  THEME_PRESETS,
  getThemePreset,
} from '@tmbk/canshift-core'
import { useState } from 'react'
import { useDashboardStore } from '../../stores/dashboard.store'

// Chrome — mirrors PropertyPanel so the two panels feel like one surface.
const PANEL_LABEL = '#AAAAAA'
const PANEL_HINT = '#666666'
const PANEL_SECTION = '#888888'
const INPUT_BG = '#111111'
const INPUT_BORDER = '#333333'
const HEX_FG = '#CCCCCC'
const RESET_FG = '#7788CC'
const TAB_ACTIVE_BG = '#1A1A1A'
const TAB_ACTIVE_BORDER = '#444444'
const TAB_FG = '#AAAAAA'

// Display labels for each palette slot — kept here (not in canshift-core) so
// the wording can iterate without bumping the shared library.
const PALETTE_LABELS: Record<keyof PagePalette, string> = {
  surface: 'Surface',
  primary: 'Primary',
  accent: 'Accent',
  text: 'Text',
  textDim: 'Text dim',
  warning: 'Warning',
  danger: 'Danger',
  success: 'Success',
}

const PALETTE_KEYS: (keyof PagePalette)[] = [
  'surface',
  'primary',
  'accent',
  'text',
  'textDim',
  'warning',
  'danger',
  'success',
]

type ActiveMode = 'day' | 'night'

interface ColorRowProps {
  label: string
  value: `#${string}`
  onChange: (hex: `#${string}`) => void
}

function ColorRow({ label, value, onChange }: ColorRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
      }}
    >
      <span style={{ flex: 1, fontSize: 11, color: PANEL_LABEL }}>{label}</span>
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: 10,
          color: HEX_FG,
          width: 64,
          textAlign: 'right',
        }}
      >
        {value.toUpperCase()}
      </span>
      <input
        type="color"
        value={value}
        aria-label={`${label} color`}
        onChange={(e) => {
          onChange(e.target.value as `#${string}`)
        }}
        style={{
          width: 32,
          height: 24,
          padding: 2,
          background: INPUT_BG,
          border: `1px solid ${INPUT_BORDER}`,
          borderRadius: 3,
          cursor: 'pointer',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}

interface ModeTabProps {
  label: string
  active: boolean
  onClick: () => void
}

function ModeTab({ label, active, onClick }: ModeTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        flex: 1,
        padding: '4px 8px',
        fontSize: 10,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        background: active ? TAB_ACTIVE_BG : 'transparent',
        border: `1px solid ${active ? TAB_ACTIVE_BORDER : INPUT_BORDER}`,
        borderRadius: 3,
        color: TAB_FG,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

export default function ThemePanel() {
  const config = useDashboardStore((s) => s.config)
  const setDayTheme = useDashboardStore((s) => s.setDayTheme)
  const setNightTheme = useDashboardStore((s) => s.setNightTheme)

  const [activeMode, setActiveMode] = useState<ActiveMode>('day')

  if (!config) {
    return (
      <div style={{ padding: 12 }}>
        <p style={{ color: PANEL_HINT, fontSize: 11 }}>No config loaded.</p>
      </div>
    )
  }

  // Resolve to defaults so the user always sees real values to edit even when
  // the loaded config is missing one half of the theme (older configs may
  // carry only `bgColor` without an explicit palette).
  const dayBg = config.dayTheme?.bgColor ?? DAY_BG_DEFAULT
  const dayPalette = config.dayTheme?.palette ?? DAY_PALETTE_DEFAULT
  const nightBg = config.nightTheme?.bgColor ?? NIGHT_BG_DEFAULT
  const nightPalette = config.nightTheme?.palette ?? NIGHT_PALETTE_DEFAULT

  const activeBg = activeMode === 'day' ? dayBg : nightBg
  const activePalette = activeMode === 'day' ? dayPalette : nightPalette
  const setActiveTheme = activeMode === 'day' ? setDayTheme : setNightTheme
  const defaultPreset = activeMode === 'day' ? DAY_THEME_PRESET : NIGHT_THEME_PRESET
  const sectionLabel = activeMode === 'day' ? 'Day theme' : 'Night theme'

  const updateBgColor = (hex: `#${string}`) => {
    setActiveTheme({ bgColor: hex, palette: activePalette })
  }

  const updatePaletteColor = (key: keyof PagePalette, hex: `#${string}`) => {
    setActiveTheme({ bgColor: activeBg, palette: { ...activePalette, [key]: hex } })
  }

  const resetToDefault = () => {
    setActiveTheme(defaultPreset)
  }

  const applyPreset = (id: ThemePresetId) => {
    const entry = getThemePreset(id)
    if (!entry) return
    setActiveTheme(entry.theme)
  }

  const copyDayToNight = () => {
    const snapshot: ThemePreset = { bgColor: dayBg, palette: dayPalette }
    setNightTheme(snapshot)
  }

  const copyNightToDay = () => {
    const snapshot: ThemePreset = { bgColor: nightBg, palette: nightPalette }
    setDayTheme(snapshot)
  }

  return (
    <div style={{ padding: 12, overflowY: 'auto', flex: 1 }}>
      {/* Day / Night editor tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <ModeTab
          label="Day theme"
          active={activeMode === 'day'}
          onClick={() => {
            setActiveMode('day')
          }}
        />
        <ModeTab
          label="Night theme"
          active={activeMode === 'night'}
          onClick={() => {
            setActiveMode('night')
          }}
        />
      </div>

      {/* Preset picker + reset */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 10,
        }}
      >
        <label
          htmlFor="theme-preset-picker"
          style={{ fontSize: 10, color: PANEL_LABEL, letterSpacing: '0.04em' }}
        >
          Preset
        </label>
        <select
          id="theme-preset-picker"
          aria-label="Apply theme preset to active theme"
          defaultValue=""
          onChange={(e) => {
            const value = e.target.value
            if (value === '') return
            applyPreset(value as ThemePresetId)
            // Reset the select so re-picking the same preset re-applies it.
            e.target.value = ''
          }}
          style={{
            flex: 1,
            background: INPUT_BG,
            border: `1px solid ${INPUT_BORDER}`,
            borderRadius: 3,
            color: HEX_FG,
            fontSize: 10,
            padding: '3px 6px',
          }}
        >
          <option value="">Apply preset…</option>
          {THEME_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={resetToDefault}
          title={`Reset to default ${sectionLabel.toLowerCase()}`}
          style={{
            background: 'none',
            border: `1px solid ${INPUT_BORDER}`,
            borderRadius: 3,
            color: RESET_FG,
            cursor: 'pointer',
            fontSize: 10,
            padding: '3px 7px',
          }}
        >
          Reset
        </button>
      </div>

      {/* Copy helpers */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button
          type="button"
          onClick={copyDayToNight}
          title="Copy current day theme into night theme"
          style={{
            flex: 1,
            background: 'none',
            border: `1px solid ${INPUT_BORDER}`,
            borderRadius: 3,
            color: TAB_FG,
            cursor: 'pointer',
            fontSize: 10,
            padding: '3px 7px',
          }}
        >
          Copy day → night
        </button>
        <button
          type="button"
          onClick={copyNightToDay}
          title="Copy current night theme into day theme"
          style={{
            flex: 1,
            background: 'none',
            border: `1px solid ${INPUT_BORDER}`,
            borderRadius: 3,
            color: TAB_FG,
            cursor: 'pointer',
            fontSize: 10,
            padding: '3px 7px',
          }}
        >
          Copy night → day
        </button>
      </div>

      <div
        style={{
          fontSize: 10,
          color: PANEL_SECTION,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 6,
        }}
      >
        Background ({sectionLabel})
      </div>
      <ColorRow label="Page background" value={activeBg} onChange={updateBgColor} />

      <div
        style={{
          fontSize: 10,
          color: PANEL_SECTION,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginTop: 12,
          marginBottom: 6,
        }}
      >
        Palette
      </div>
      {PALETTE_KEYS.map((key) => (
        <ColorRow
          key={key}
          label={PALETTE_LABELS[key]}
          value={activePalette[key]}
          onChange={(hex) => {
            updatePaletteColor(key, hex)
          }}
        />
      ))}
    </div>
  )
}

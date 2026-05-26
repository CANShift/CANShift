// ThemePanel.tsx — Editor for the dashboard's day-theme palette (#21).
//
// Lives next to PropertyPanel in the editor sidebar. Renders the active
// `config.dayTheme` as a list of color rows: label + native `<input type="color">`
// + hex display.
//
// Skeleton commit — read-only rendering against the store. Write wiring
// (color edits + reset-to-default + tab switching) lands in follow-up commits
// per the issue #21 scaffold split.

import type { PagePalette } from '@tmbk/canshift-core'
import { DAY_BG_DEFAULT, DAY_PALETTE_DEFAULT } from '@tmbk/canshift-core'
import { useDashboardStore } from '../../stores/dashboard.store'

// Chrome — mirrors PropertyPanel so the two panels feel like one surface.
const PANEL_LABEL = '#AAAAAA'
const PANEL_HINT = '#666666'
const PANEL_SECTION = '#888888'
const INPUT_BG = '#111111'
const INPUT_BORDER = '#333333'
const HEX_FG = '#CCCCCC'

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

interface ColorRowProps {
  label: string
  value: `#${string}`
}

function ColorRow({ label, value }: ColorRowProps) {
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
        readOnly
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

export default function ThemePanel() {
  const config = useDashboardStore((s) => s.config)

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
  const bgColor = config.dayTheme?.bgColor ?? DAY_BG_DEFAULT
  const palette = config.dayTheme?.palette ?? DAY_PALETTE_DEFAULT

  return (
    <div style={{ padding: 12, overflowY: 'auto', flex: 1 }}>
      <div
        style={{
          fontSize: 10,
          color: PANEL_LABEL,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: 10,
        }}
      >
        Day theme
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
        Background
      </div>
      <ColorRow label="Page background" value={bgColor} />

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
        <ColorRow key={key} label={PALETTE_LABELS[key]} value={palette[key]} />
      ))}
    </div>
  )
}

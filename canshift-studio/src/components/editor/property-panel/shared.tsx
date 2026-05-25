// property-panel/shared.tsx — Primitives, styles, constants, and the
// `ConfigFieldsProps` contract reused by every per-widget editor split out
// from the legacy `PropertyPanel.tsx` (#697).

import React from 'react'
import type {
  GaugeDisplayStyle,
  SensorIconName,
  SignalDef,
  Widget,
  WidgetLabelPosition,
} from '@tmbk/canshift-core'
import { SENSOR_ICON_LABELS, SENSOR_ICON_NAMES, SensorIcon } from '../../icons/SensorIcons'

// ---------------------------------------------------------------------------
// MIRROR chrome shades — preserved verbatim because they do not yet map to a
// core design token. Re-exported so every per-widget editor in this folder
// shares a single source for the property-panel chip / tile chrome (no per-
// file copies). Audit S-H-5, umbrella #1015 — flagged for token promotion.
// ---------------------------------------------------------------------------
export const PANEL_INPUT_BG = '#111111' // MIRROR: between --scrim (#000000) and --bg (#121212)
export const PANEL_TILE_BORDER = '#2A2A2A' // MIRROR: between --bg (#121212) and --surface (#1F1F1F)
export const PANEL_TEXT_DIM = '#AAAAAA' // MIRROR: between --text-dim (#BABABA) and --text-muted (#8F8F8F)
export const PANEL_LABEL_MUTED = '#666666' // MIRROR: darker than --text-muted (#8F8F8F)
// Green "active" tile family (success-tinted) — custom dim-green chrome, no token match.
export const TILE_ACTIVE_GREEN_BG = '#1A2A1A' // MIRROR: dim-green active chrome
export const TILE_ACTIVE_GREEN_BORDER = '#448844' // MIRROR: darker than --success (#00CC2A)
export const TILE_ACTIVE_GREEN_FG = '#66AA66' // MIRROR: dimmer green than --success
// Blue "active" tile family — custom cool-blue accent, no token match.
export const TILE_ACTIVE_BLUE_BG = '#2A2A3A' // MIRROR: custom dim-blue active chrome
export const TILE_ACTIVE_BLUE_BORDER = '#5566AA' // MIRROR: cool-blue accent (no token)
export const TILE_ACTIVE_BLUE_FG = '#7788CC' // MIRROR: lighter cool-blue accent

// ---------------------------------------------------------------------------
// Field + Row primitives — keep the original look-and-feel verbatim. Inline
// styles are deliberate: PropertyPanel pre-dates the Tailwind migration and
// a wholesale rewrite is out of scope for this refactor.
// ---------------------------------------------------------------------------

// File-local MIRRORs not exported (single-use).
const RESET_BTN_FG = '#555555' // MIRROR: slightly darker than PANEL_LABEL_MUTED (#666666)
const INPUT_TEXT = '#CCCCCC' // MIRROR: close to --text-dim (#BABABA), input text
const ICON_PICKER_BG = '#1A1A1A' // MIRROR: between PANEL_INPUT_BG (#111111) and --bg (#121212)

export function Field({
  label,
  children,
  onReset,
}: {
  label: string
  children: React.ReactNode
  /** Show a small reset icon next to the label that calls back when clicked. */
  onReset?: (() => void) | undefined
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
        <label
          style={{
            display: 'block',
            fontSize: 10,
            color: PANEL_LABEL_MUTED,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {label}
        </label>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            title="Reset to default"
            style={{
              padding: 0,
              width: 14,
              height: 14,
              background: 'transparent',
              border: 'none',
              color: RESET_BTN_FG,
              cursor: 'pointer',
              fontSize: 11,
              lineHeight: '14px',
            }}
          >
            ↺
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 7px',
  background: PANEL_INPUT_BG,
  border: '1px solid hsl(var(--border))',
  borderRadius: 3,
  color: INPUT_TEXT,
  fontSize: 12,
  boxSizing: 'border-box',
  outline: 'none',
}

export const numberInputStyle: React.CSSProperties = {
  ...inputStyle,
  width: '100%',
}

export function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 6 }}>{children}</div>
}

// ---------------------------------------------------------------------------
// Icon picker — used by both ButtonFields and WarningFields.
// ---------------------------------------------------------------------------

export function IconPicker({
  value,
  onChange,
}: {
  value: SensorIconName | undefined
  onChange: (name: SensorIconName | undefined) => void
}) {
  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 4,
          marginBottom: 4,
        }}
      >
        {SENSOR_ICON_NAMES.map((name) => (
          <button
            key={name}
            title={SENSOR_ICON_LABELS[name]}
            onClick={() => {
              onChange(value === name ? undefined : name)
            }}
            style={{
              padding: 5,
              background: value === name ? TILE_ACTIVE_BLUE_BG : ICON_PICKER_BG,
              border: `1px solid ${value === name ? TILE_ACTIVE_BLUE_BORDER : PANEL_TILE_BORDER}`,
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SensorIcon
              name={name}
              size={16}
              color={value === name ? TILE_ACTIVE_BLUE_FG : PANEL_TEXT_DIM}
            />
          </button>
        ))}
      </div>
      {value && (
        <div style={{ fontSize: 10, color: TILE_ACTIVE_BLUE_BORDER }}>
          {SENSOR_ICON_LABELS[value]}
          <button
            onClick={() => {
              onChange(undefined)
            }}
            style={{
              marginLeft: 6,
              background: 'none',
              border: 'none',
              color: PANEL_TEXT_DIM,
              cursor: 'pointer',
              fontSize: 10,
            }}
          >
            ✕ clear
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

export interface ConfigFieldsProps {
  widget: Widget
  onChange: (patch: Partial<Widget>) => void
  /** Definition for the bound signal (when one is bound) — used to resolve "reset to default". */
  signalDef?: SignalDef | undefined
}

export const GAUGE_STYLES: { value: GaugeDisplayStyle; label: string }[] = [
  { value: 'arc', label: 'Arc' },
  { value: 'bar', label: 'Bar' },
  { value: 'numeric', label: 'Numeric' },
]

/** All automotive units available as quick chips. */
export const ALL_UNITS = [
  'rpm',
  'km/h',
  'mph',
  '%',
  '°C',
  '°F',
  'bar',
  'psi',
  'V',
  'λ',
  'AFR',
  'kPa',
  's',
]

/** Units relevant to each signal — restricts the chips shown when a signal is bound. */
export const SIGNAL_UNITS: Record<string, string[]> = {
  rpm: ['rpm'],
  throttle_pos: ['%'],
  map_kpa: ['kPa', 'psi', 'bar'],
  iat_c: ['°C', '°F'],
  speed_kph: ['km/h', 'mph'],
  lambda_1: ['λ', 'AFR'],
  fuel_press_bar: ['bar', 'psi', 'kPa'],
  coolant_temp_c: ['°C', '°F'],
  oil_temp_c: ['°C', '°F'],
  oil_press_bar: ['bar', 'psi', 'kPa'],
  battery_volts: ['V'],
}

/** Label position options shared by every widget that exposes a corner label. */
export const GAUGE_LABEL_POSITIONS: { value: WidgetLabelPosition; label: string }[] = [
  { value: 'top-left', label: '↖ TL' },
  { value: 'top-right', label: '↗ TR' },
  { value: 'bottom-left', label: '↙ BL' },
  { value: 'bottom-right', label: '↘ BR' },
]

// Reusable label / labelPosition editor block — used by every widget editor
// that supports a corner label (gauge, bar, warning, timer, gear, image).
export interface LabelEditableConfig {
  label?: string
  labelPosition?: WidgetLabelPosition
}

export function LabelFields<T extends LabelEditableConfig>({
  cfg,
  onChange,
}: {
  cfg: T
  onChange: (next: T) => void
}) {
  return (
    <>
      <Field label="Label">
        <input
          style={inputStyle}
          placeholder="e.g. RPM, Coolant…"
          value={cfg.label ?? ''}
          onChange={(e) => {
            const next = { ...cfg }
            if (e.target.value) next.label = e.target.value
            else delete next.label
            onChange(next)
          }}
        />
      </Field>
      {cfg.label && (
        <Field label="Label pos.">
          <div style={{ display: 'flex', gap: 3 }}>
            {GAUGE_LABEL_POSITIONS.map(({ value, label }) => {
              const isActive = (cfg.labelPosition ?? 'top-left') === value
              return (
                <button
                  key={value}
                  onClick={() => {
                    onChange({ ...cfg, labelPosition: value })
                  }}
                  style={{
                    flex: 1,
                    padding: '3px 0',
                    fontSize: 9,
                    background: isActive ? TILE_ACTIVE_BLUE_BG : PANEL_INPUT_BG,
                    border: `1px solid ${isActive ? TILE_ACTIVE_BLUE_BORDER : PANEL_TILE_BORDER}`,
                    borderRadius: 3,
                    color: isActive ? TILE_ACTIVE_BLUE_FG : PANEL_TEXT_DIM,
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </Field>
      )}
    </>
  )
}

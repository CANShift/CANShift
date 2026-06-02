// property-panel/shared.tsx — Primitives, styles, constants, and the
// `ConfigFieldsProps` contract reused by every per-widget editor split out
// from the legacy `PropertyPanel.tsx` (#697).

import React from 'react'
import type {
  GaugeDisplayStyle,
  SensorIconName,
  SignalDef,
  Widget,
} from '@tmbk/canshift-core'
import { SENSOR_ICON_LABELS, SENSOR_ICON_NAMES, SensorIcon } from '../../icons/SensorIcons'

// ---------------------------------------------------------------------------
// Field + Row primitives — keep the original look-and-feel verbatim. Inline
// styles are deliberate: PropertyPanel pre-dates the Tailwind migration and
// a wholesale rewrite is out of scope for this refactor.
// ---------------------------------------------------------------------------

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
            color: '#666666',
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
              color: '#555555',
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
  background: '#111111',
  border: '1px solid #333333',
  borderRadius: 3,
  color: '#CCCCCC',
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
              background: value === name ? '#2A2A3A' : '#1A1A1A',
              border: `1px solid ${value === name ? '#5566AA' : '#2A2A2A'}`,
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SensorIcon name={name} size={16} color={value === name ? '#7788CC' : '#AAAAAA'} />
          </button>
        ))}
      </div>
      {value && (
        <div style={{ fontSize: 10, color: '#5566AA' }}>
          {SENSOR_ICON_LABELS[value]}
          <button
            onClick={() => {
              onChange(undefined)
            }}
            style={{
              marginLeft: 6,
              background: 'none',
              border: 'none',
              color: '#AAAAAA',
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


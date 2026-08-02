import React from 'react'
import type { GaugeDisplayStyle, SensorIconName, SignalDef, Widget } from '@tmbk/canshift-core'
import { SENSOR_ICON_LABELS, SENSOR_ICON_NAMES, SensorIcon } from '../../icons/SensorIcons'

export const Field = ({
  label,
  children,
  onReset,
}: {
  label: string
  children: React.ReactNode
  onReset?: (() => void) | undefined
}) => {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
        <label
          style={{
            display: 'block',
            fontSize: 10,
            color: 'hsl(var(--brand-neutral-500))',
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
              color: 'hsl(var(--brand-neutral-500))',
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
  background: 'hsl(var(--brand-neutral-100))',
  border: '1px solid hsl(var(--brand-neutral-300))',
  color: 'hsl(var(--brand-neutral-700))',
  fontSize: 12,
  boxSizing: 'border-box',
  outline: 'none',
}

export const numberInputStyle: React.CSSProperties = {
  ...inputStyle,
  width: '100%',
}

export const Row = ({ children }: { children: React.ReactNode }) => {
  return <div style={{ display: 'flex', gap: 6 }}>{children}</div>
}

export const IconPicker = ({
  value,
  onChange,
}: {
  value: SensorIconName | undefined
  onChange: (name: SensorIconName | undefined) => void
}) => {
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
              background:
                value === name
                  ? 'color-mix(in srgb, #5566AA 14%, transparent)'
                  : 'hsl(var(--brand-neutral-100))',
              border: `1px solid ${value === name ? '#5566AA' : 'hsl(var(--brand-neutral-300))'}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SensorIcon
              name={name}
              size={16}
              color={value === name ? '#7788CC' : 'hsl(var(--brand-neutral-600))'}
            />
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
              color: 'hsl(var(--brand-neutral-600))',
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

export interface ConfigFieldsProps {
  widget: Widget
  onChange: (patch: Partial<Widget>) => void
  signalDef?: SignalDef | undefined
}

export const GAUGE_STYLES: { value: GaugeDisplayStyle; label: string }[] = [
  { value: 'arc', label: 'Arc' },
  { value: 'numeric', label: 'Numeric' },
]

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

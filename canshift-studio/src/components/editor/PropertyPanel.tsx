// PropertyPanel.tsx — Editor for the selected widget's properties.
// Layout (x, y, w, h), signal binding, style, and type-specific config.

import React from 'react'
import type { Widget, SensorIconName, WidgetType } from '@tmbk/canshift-core'
import { useDashboardStore } from '../../stores/dashboard.store'
import { useSignalStore } from '../../stores/signal.store'
import { SensorIcon, SENSOR_ICON_NAMES, SENSOR_ICON_LABELS } from '../icons/SensorIcons'
import { IconTrash } from '../icons/Icon'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label
        style={{
          display: 'block',
          fontSize: 10,
          color: '#666666',
          marginBottom: 3,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
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

const numberInputStyle: React.CSSProperties = {
  ...inputStyle,
  width: '100%',
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 6 }}>{children}</div>
}

// ---------------------------------------------------------------------------
// Icon picker
// ---------------------------------------------------------------------------

function IconPicker({
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
            <SensorIcon name={name} size={16} color={value === name ? '#7788CC' : '#555555'} />
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
              color: '#444444',
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
// Config-specific fields
// ---------------------------------------------------------------------------

interface ConfigFieldsProps {
  widget: Widget
  onChange: (patch: Partial<Widget>) => void
}

function GaugeFields({ widget, onChange }: ConfigFieldsProps) {
  const cfg = widget.config.type === 'gauge' ? widget.config : null
  if (!cfg) return null
  return (
    <>
      <Row>
        <Field label="Min">
          <input
            type="number"
            style={numberInputStyle}
            value={cfg.minValue}
            onChange={(e) => {
              onChange({ config: { ...cfg, minValue: Number(e.target.value) } })
            }}
          />
        </Field>
        <Field label="Max">
          <input
            type="number"
            style={numberInputStyle}
            value={cfg.maxValue}
            onChange={(e) => {
              onChange({ config: { ...cfg, maxValue: Number(e.target.value) } })
            }}
          />
        </Field>
      </Row>
      <Row>
        <Field label="Warn">
          <input
            type="number"
            style={numberInputStyle}
            value={cfg.warningLevel}
            onChange={(e) => {
              onChange({ config: { ...cfg, warningLevel: Number(e.target.value) } })
            }}
          />
        </Field>
        <Field label="Danger">
          <input
            type="number"
            style={numberInputStyle}
            value={cfg.dangerLevel}
            onChange={(e) => {
              onChange({ config: { ...cfg, dangerLevel: Number(e.target.value) } })
            }}
          />
        </Field>
      </Row>
      <Field label="Icon">
        <IconPicker
          value={cfg.iconName}
          onChange={(name) => {
            onChange({
              config: name ? { ...cfg, iconName: name } : (({ iconName: _, ...r }) => r)(cfg),
            })
          }}
        />
      </Field>
    </>
  )
}

function LabelFields({ widget, onChange }: ConfigFieldsProps) {
  const cfg = widget.config.type === 'label' ? widget.config : null
  if (!cfg) return null
  return (
    <>
      <Row>
        <Field label="Prefix">
          <input
            style={inputStyle}
            value={cfg.prefix ?? ''}
            onChange={(e) => {
              const next = { ...cfg }
              if (e.target.value) next.prefix = e.target.value
              else delete next.prefix
              onChange({ config: next })
            }}
          />
        </Field>
        <Field label="Suffix">
          <input
            style={inputStyle}
            value={cfg.suffix ?? ''}
            onChange={(e) => {
              const next = { ...cfg }
              if (e.target.value) next.suffix = e.target.value
              else delete next.suffix
              onChange({ config: next })
            }}
          />
        </Field>
      </Row>
      <Field label="Decimals">
        <input
          type="number"
          min={0}
          max={4}
          style={{ ...numberInputStyle, width: 60 }}
          value={cfg.decimalPlaces}
          onChange={(e) => {
            onChange({ config: { ...cfg, decimalPlaces: Number(e.target.value) } })
          }}
        />
      </Field>
      <Field label="Icon">
        <IconPicker
          value={cfg.iconName}
          onChange={(name) => {
            onChange({
              config: name ? { ...cfg, iconName: name } : (({ iconName: _, ...r }) => r)(cfg),
            })
          }}
        />
      </Field>
    </>
  )
}

function ButtonFields({ widget, onChange }: ConfigFieldsProps) {
  const cfg = widget.config.type === 'button' ? widget.config : null
  if (!cfg) return null
  return (
    <>
      <Field label="Label">
        <input
          style={inputStyle}
          value={cfg.label}
          onChange={(e) => {
            onChange({ config: { ...cfg, label: e.target.value } })
          }}
        />
      </Field>
      <Field label="Target Page ID">
        <input
          style={inputStyle}
          value={cfg.targetPageId}
          onChange={(e) => {
            onChange({ config: { ...cfg, targetPageId: e.target.value } })
          }}
        />
      </Field>
      <Field label="Show">
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#AAAAAA' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={cfg.showLabel !== false}
              onChange={(e) => {
                onChange({ config: { ...cfg, showLabel: e.target.checked } })
              }}
            />
            Text
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={cfg.showIcon === true}
              onChange={(e) => {
                onChange({ config: { ...cfg, showIcon: e.target.checked } })
              }}
            />
            Icon
          </label>
        </div>
      </Field>
      {(cfg.showIcon ?? false) && (
        <Field label="Icon">
          <IconPicker
            value={cfg.iconName}
            onChange={(name) => {
              onChange({
                config: name ? { ...cfg, iconName: name } : (({ iconName: _, ...r }) => r)(cfg),
              })
            }}
          />
        </Field>
      )}
    </>
  )
}

function BarFields({ widget, onChange }: ConfigFieldsProps) {
  const cfg = widget.config.type === 'bar' ? widget.config : null
  if (!cfg) return null
  return (
    <>
      <Row>
        <Field label="Prefix">
          <input
            style={inputStyle}
            value={cfg.prefix ?? ''}
            onChange={(e) => {
              const next = { ...cfg }
              if (e.target.value) next.prefix = e.target.value
              else delete next.prefix
              onChange({ config: next })
            }}
          />
        </Field>
        <Field label="Suffix">
          <input
            style={inputStyle}
            value={cfg.suffix ?? ''}
            onChange={(e) => {
              const next = { ...cfg }
              if (e.target.value) next.suffix = e.target.value
              else delete next.suffix
              onChange({ config: next })
            }}
          />
        </Field>
      </Row>
      <Field label="Icon">
        <IconPicker
          value={cfg.iconName}
          onChange={(name) => {
            onChange({
              config: name ? { ...cfg, iconName: name } : (({ iconName: _, ...r }) => r)(cfg),
            })
          }}
        />
      </Field>
    </>
  )
}

function WarningFields({ widget, onChange }: ConfigFieldsProps) {
  const cfg = widget.config.type === 'warning' ? widget.config : null
  if (!cfg) return null
  return (
    <>
      <Field label="Threshold">
        <input
          type="number"
          style={numberInputStyle}
          value={cfg.threshold}
          onChange={(e) => {
            onChange({ config: { ...cfg, threshold: Number(e.target.value) } })
          }}
        />
      </Field>
      <Field label="Invert Logic">
        <input
          type="checkbox"
          checked={cfg.invertLogic ?? false}
          onChange={(e) => {
            onChange({ config: { ...cfg, invertLogic: e.target.checked } })
          }}
        />
      </Field>
      <Field label="Icon">
        <IconPicker
          value={cfg.iconName}
          onChange={(name) => {
            onChange({
              config: name ? { ...cfg, iconName: name } : (({ iconName: _, ...r }) => r)(cfg),
            })
          }}
        />
      </Field>
    </>
  )
}

const CONFIG_FIELDS: Partial<
  Record<WidgetType, (props: ConfigFieldsProps) => React.JSX.Element | null>
> = {
  gauge: GaugeFields,
  label: LabelFields,
  button: ButtonFields,
  bar: BarFields,
  warning: WarningFields,
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

interface PropertyPanelProps {
  pageId: string
}

export default function PropertyPanel({ pageId }: PropertyPanelProps) {
  const config = useDashboardStore((s) => s.config)
  const selectedWidgetId = useDashboardStore((s) => s.selectedWidgetId)
  const updateWidget = useDashboardStore((s) => s.updateWidget)
  const removeWidget = useDashboardStore((s) => s.removeWidget)
  const signals = useSignalStore((s) => s.signals)

  const page = config?.pages.find((p) => p.id === pageId)
  const widget = page?.widgets.find((w) => w.id === selectedWidgetId)

  if (!widget) {
    return (
      <div style={{ padding: 12 }}>
        <div
          style={{
            fontSize: 10,
            color: '#555555',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 12,
          }}
        >
          Properties
        </div>
        <p style={{ color: '#444444', fontSize: 11, lineHeight: 1.6 }}>
          Click a widget on the canvas to edit its properties.
        </p>
      </div>
    )
  }

  const patch = (p: Partial<Widget>) => {
    updateWidget(pageId, widget.id, p)
  }

  const ConfigFields = CONFIG_FIELDS[widget.type]

  return (
    <div style={{ padding: 12, overflowY: 'auto', flex: 1 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              color: '#555555',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Properties
          </div>
          <div style={{ fontSize: 12, color: '#CC4444', fontWeight: 600, marginTop: 2 }}>
            {widget.type}
          </div>
        </div>
        <button
          onClick={() => {
            removeWidget(pageId, widget.id)
          }}
          title="Delete widget (Del)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: '1px solid #3A1A1A',
            borderRadius: 3,
            color: '#AA3333',
            cursor: 'pointer',
            fontSize: 11,
            padding: '3px 7px',
          }}
        >
          <IconTrash size={11} color="#AA3333" />
          Delete
        </button>
      </div>

      {/* ID (read-only) */}
      <Field label="ID">
        <div style={{ fontSize: 10, color: '#444444', fontFamily: 'monospace', padding: '3px 0' }}>
          {widget.id}
        </div>
      </Field>

      {/* Signal binding — not applicable for button / timer / image */}
      {!['button', 'timer', 'image'].includes(widget.type) && (
        <Field label="Signal">
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={widget.signal}
            onChange={(e) => {
              patch({ signal: e.target.value })
            }}
          >
            <option value="">— none —</option>
            {signals.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}{s.unit ? ` (${s.unit})` : ''}
              </option>
            ))}
          </select>
        </Field>
      )}

      {/* Layout */}
      <div
        style={{
          fontSize: 10,
          color: '#444444',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 6,
          marginTop: 2,
        }}
      >
        Layout
      </div>
      <Row>
        <Field label="X">
          <input
            type="number"
            style={numberInputStyle}
            value={widget.layout.x}
            onChange={(e) => {
              patch({ layout: { ...widget.layout, x: Number(e.target.value) } })
            }}
          />
        </Field>
        <Field label="Y">
          <input
            type="number"
            style={numberInputStyle}
            value={widget.layout.y}
            onChange={(e) => {
              patch({ layout: { ...widget.layout, y: Number(e.target.value) } })
            }}
          />
        </Field>
      </Row>
      <Row>
        <Field label="W">
          <input
            type="number"
            min={8}
            style={numberInputStyle}
            value={widget.layout.w}
            onChange={(e) => {
              patch({ layout: { ...widget.layout, w: Number(e.target.value) } })
            }}
          />
        </Field>
        <Field label="H">
          <input
            type="number"
            min={8}
            style={numberInputStyle}
            value={widget.layout.h}
            onChange={(e) => {
              patch({ layout: { ...widget.layout, h: Number(e.target.value) } })
            }}
          />
        </Field>
      </Row>

      {/* Style */}
      <div
        style={{
          fontSize: 10,
          color: '#444444',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 6,
          marginTop: 4,
        }}
      >
        Style
      </div>
      <Row>
        <Field label="Color">
          <input
            type="color"
            value={widget.style.primaryColor}
            style={{
              width: '100%',
              height: 28,
              padding: 2,
              background: '#111',
              border: '1px solid #333',
              borderRadius: 3,
              cursor: 'pointer',
            }}
            onChange={(e) => {
              patch({ style: { ...widget.style, primaryColor: e.target.value as `#${string}` } })
            }}
          />
        </Field>
        <Field label="Text">
          <input
            type="color"
            value={widget.style.textColor}
            style={{
              width: '100%',
              height: 28,
              padding: 2,
              background: '#111',
              border: '1px solid #333',
              borderRadius: 3,
              cursor: 'pointer',
            }}
            onChange={(e) => {
              patch({ style: { ...widget.style, textColor: e.target.value as `#${string}` } })
            }}
          />
        </Field>
      </Row>
      <Field label="Font size">
        <input
          type="number"
          min={8}
          max={72}
          style={{ ...numberInputStyle, width: 70 }}
          value={widget.style.fontSize}
          onChange={(e) => {
            patch({ style: { ...widget.style, fontSize: Number(e.target.value) } })
          }}
        />
      </Field>

      {/* Type-specific config */}
      {ConfigFields && (
        <>
          <div
            style={{
              fontSize: 10,
              color: '#444444',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 6,
              marginTop: 4,
            }}
          >
            {widget.type} config
          </div>
          <ConfigFields widget={widget} onChange={patch} />
        </>
      )}
    </div>
  )
}

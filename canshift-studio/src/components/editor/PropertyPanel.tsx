// PropertyPanel.tsx — Editor for the selected widget's properties.
// Layout (x, y, w, h), signal binding, style, and type-specific config.

import React, { useState } from 'react'
import type {
  Widget,
  SensorIconName,
  WidgetType,
  ButtonAction,
  GaugeDisplayStyle,
  WidgetLabelPosition,
} from '@tmbk/canshift-core'
import { useDashboardStore } from '../../stores/dashboard.store'
import { useSignalStore } from '../../stores/signal.store'
import { SensorIcon, SENSOR_ICON_NAMES, SENSOR_ICON_LABELS } from '../icons/SensorIcons'
import { IconTrash } from '../icons/Icon'
import { WidgetPreview } from './WidgetPreview'

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

const GAUGE_STYLES: { value: GaugeDisplayStyle; label: string }[] = [
  { value: 'arc', label: 'Arc' },
  { value: 'bar', label: 'Bar' },
  { value: 'numeric', label: 'Numeric' },
]

interface SizePreset {
  label: string
  w: number
  h: number
}

// Fixed size presets per display style — grid-aligned to SNAP_GRID (10px).
//
// Column system: 3 × 100px + 2 × 10px gap = 320px (exact canvas fill).
//   1-col = 100px  |  2-col = 210px (100+10+100)  |  3-col = 320px
//
// Arc:     square — S=70, M=100 (3/row), L=150 (2/row)
// Bar:     vertical thermometer — half or full canvas height
// Numeric: flat wide — S=100 (3/row), M=210 (2-col), L=320 (full width)
const GAUGE_SIZE_PRESETS: Record<GaugeDisplayStyle, SizePreset[]> = {
  arc: [
    { label: 'S', w: 70, h: 70 },
    { label: 'M', w: 100, h: 100 },
    { label: 'L', w: 150, h: 150 },
  ],
  // Bar: narrow fixed width, either full canvas height or half canvas height.
  // Canvas widget area ≈ 220px (240 − topbar), rounded to grid.
  bar: [
    { label: '½ S', w: 20, h: 110 },
    { label: '½ M', w: 30, h: 110 },
    { label: 'Full S', w: 20, h: 220 },
    { label: 'Full M', w: 30, h: 220 },
  ],
  numeric: [
    { label: 'S', w: 100, h: 40 },
    { label: 'M', w: 210, h: 40 },
    { label: 'L', w: 320, h: 40 },
  ],
}

// Common automotive unit quick-select chips
const COMMON_UNITS = ['rpm', 'km/h', '%', '°C', 'bar', 'V', 'λ', 'AFR', 'kPa', 'psi', 's']

// Label position options for gauge widgets
const GAUGE_LABEL_POSITIONS: { value: WidgetLabelPosition; label: string }[] = [
  { value: 'top-left', label: '↖ TL' },
  { value: 'top-right', label: '↗ TR' },
  { value: 'bottom-left', label: '↙ BL' },
  { value: 'bottom-right', label: '↘ BR' },
]

// Default preset index when switching to a style (M = index 1)
const DEFAULT_PRESET_INDEX = 1

function GaugeFields({ widget, onChange }: ConfigFieldsProps) {
  const cfg = widget.config.type === 'gauge' ? widget.config : null
  if (!cfg) return null
  const style = cfg.displayStyle
  const presets = GAUGE_SIZE_PRESETS[style]
  const { w, h } = widget.layout
  const activePresetIdx = presets.findIndex((p) => p.w === w && p.h === h)

  return (
    <>
      {/* Display style selector — switching also applies the default size */}
      <Field label="Style">
        <div style={{ display: 'flex', gap: 4 }}>
          {GAUGE_STYLES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => {
                const presetsForStyle = GAUGE_SIZE_PRESETS[value]
                const defaultPreset = presetsForStyle[DEFAULT_PRESET_INDEX] ?? presetsForStyle[0]
                if (!defaultPreset) return
                onChange({
                  config: { ...cfg, displayStyle: value },
                  layout: { ...widget.layout, w: defaultPreset.w, h: defaultPreset.h },
                })
              }}
              style={{
                flex: 1,
                padding: '3px 0',
                background: style === value ? '#2A2A3A' : '#111111',
                border: `1px solid ${style === value ? '#5566AA' : '#2A2A2A'}`,
                borderRadius: 3,
                color: style === value ? '#7788CC' : '#555555',
                cursor: 'pointer',
                fontSize: 10,
                textTransform: 'uppercase',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>

      {/* Size presets for the current style */}
      <Field label="Size">
        <div style={{ display: 'flex', gap: 4 }}>
          {presets.map((preset, idx) => {
            const isActive = idx === activePresetIdx
            return (
              <button
                key={preset.label}
                onClick={() => {
                  onChange({ layout: { ...widget.layout, w: preset.w, h: preset.h } })
                }}
                title={`${String(preset.w)} × ${String(preset.h)} px`}
                style={{
                  flex: 1,
                  padding: '3px 0',
                  background: isActive ? '#1A2A1A' : '#111111',
                  border: `1px solid ${isActive ? '#448844' : '#2A2A2A'}`,
                  borderRadius: 3,
                  color: isActive ? '#66AA66' : '#555555',
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: isActive ? 700 : 400,
                }}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
        {activePresetIdx === -1 && (
          <div style={{ fontSize: 9, color: '#444444', marginTop: 3 }}>
            {String(w)} × {String(h)} px — custom
          </div>
        )}
      </Field>

      {/* Unit / suffix — shown for all styles */}
      <Field label="Unit">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 4 }}>
          {COMMON_UNITS.map((u) => (
            <button
              key={u}
              onClick={() => {
                const next = { ...cfg }
                if (cfg.suffix === u) delete next.suffix
                else next.suffix = u
                onChange({ config: next })
              }}
              style={{
                padding: '2px 6px',
                fontSize: 10,
                background: cfg.suffix === u ? '#1A2A1A' : '#111111',
                border: `1px solid ${cfg.suffix === u ? '#448844' : '#2A2A2A'}`,
                borderRadius: 3,
                color: cfg.suffix === u ? '#66AA66' : '#555555',
                cursor: 'pointer',
              }}
            >
              {u}
            </button>
          ))}
        </div>
        <input
          style={inputStyle}
          placeholder="custom…"
          value={cfg.suffix ?? ''}
          onChange={(e) => {
            const next = { ...cfg }
            if (e.target.value) next.suffix = e.target.value
            else delete next.suffix
            onChange({ config: next })
          }}
        />
      </Field>

      {/* Numeric-specific: prefix + decimals */}
      {style === 'numeric' && (
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
            <Field label="Decimals">
              <input
                type="number"
                min={0}
                max={4}
                style={numberInputStyle}
                value={cfg.decimalPlaces}
                onChange={(e) => {
                  onChange({ config: { ...cfg, decimalPlaces: Number(e.target.value) } })
                }}
              />
            </Field>
          </Row>
        </>
      )}

      {/* Bar orientation — vertical thermometer or horizontal progress */}
      {style === 'bar' && (
        <Field label="Orientation">
          <div style={{ display: 'flex', gap: 4 }}>
            {(['vertical', 'horizontal'] as const).map((dir) => {
              const isActive = (cfg.barOrientation ?? 'vertical') === dir
              return (
                <button
                  key={dir}
                  onClick={() => {
                    // Swap w/h when switching orientation to keep visual ratio sensible
                    const currentH =
                      cfg.barOrientation === 'horizontal' ? widget.layout.w : widget.layout.h
                    const currentW =
                      cfg.barOrientation === 'horizontal' ? widget.layout.h : widget.layout.w
                    const newLayout =
                      dir === 'horizontal'
                        ? { ...widget.layout, w: currentH, h: currentW }
                        : { ...widget.layout, w: currentW, h: currentH }
                    onChange({
                      config: { ...cfg, barOrientation: dir },
                      layout: newLayout,
                    })
                  }}
                  style={{
                    flex: 1,
                    padding: '3px 0',
                    background: isActive ? '#2A2A3A' : '#111111',
                    border: `1px solid ${isActive ? '#5566AA' : '#2A2A2A'}`,
                    borderRadius: 3,
                    color: isActive ? '#7788CC' : '#555555',
                    cursor: 'pointer',
                    fontSize: 10,
                    textTransform: 'uppercase',
                  }}
                >
                  {dir === 'vertical' ? '↕ Vertical' : '↔ Horizontal'}
                </button>
              )
            })}
          </div>
        </Field>
      )}

      {/* Arc / bar shared range fields */}
      {(style === 'arc' || style === 'bar') && (
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
          {style === 'arc' && (
            <>
              <Field label="Needle">
                <input
                  type="checkbox"
                  checked={cfg.showNeedle ?? false}
                  onChange={(e) => {
                    onChange({ config: { ...cfg, showNeedle: e.target.checked } })
                  }}
                />
              </Field>
              <Field label="Rev flash">
                <input
                  type="checkbox"
                  checked={cfg.revFlash ?? false}
                  onChange={(e) => {
                    onChange({ config: { ...cfg, revFlash: e.target.checked } })
                  }}
                />
              </Field>
            </>
          )}
        </>
      )}

      {/* Widget label */}
      <Field label="Label">
        <input
          style={inputStyle}
          placeholder="e.g. RPM, Coolant…"
          value={cfg.label ?? ''}
          onChange={(e) => {
            const next = { ...cfg }
            if (e.target.value) next.label = e.target.value
            else delete next.label
            onChange({ config: next })
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
                    onChange({ config: { ...cfg, labelPosition: value } })
                  }}
                  style={{
                    flex: 1,
                    padding: '3px 0',
                    fontSize: 9,
                    background: isActive ? '#2A2A3A' : '#111111',
                    border: `1px solid ${isActive ? '#5566AA' : '#2A2A2A'}`,
                    borderRadius: 3,
                    color: isActive ? '#7788CC' : '#555555',
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

// ---------------------------------------------------------------------------
// Action editor — one action row
// ---------------------------------------------------------------------------

interface ActionRowProps {
  action: ButtonAction
  pageIds: string[]
  onUpdate: (updated: ButtonAction) => void
  onRemove: () => void
}

function ActionRow({ action, pageIds, onUpdate, onRemove }: ActionRowProps) {
  const typeLabel =
    action.category === 'dashboard'
      ? action.type === 'navigate'
        ? 'Navigate'
        : 'Set Theme'
      : action.type === 'map_switch'
        ? 'Map Switch'
        : 'CAN Raw'

  const categoryColor = action.category === 'ecu' ? '#CC8800' : '#5577CC'

  return (
    <div
      style={{
        background: '#111111',
        border: '1px solid #2A2A2A',
        borderRadius: 3,
        padding: '6px 8px',
        marginBottom: 5,
      }}
    >
      {/* Row header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 5,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: categoryColor,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {action.category} — {typeLabel}
        </span>
        <button
          onClick={onRemove}
          style={{
            background: 'none',
            border: 'none',
            color: '#553333',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
          }}
          title="Remove action"
        >
          <IconTrash size={11} color="#553333" />
        </button>
      </div>

      {/* Action-specific fields */}
      {action.category === 'dashboard' && action.type === 'navigate' && (
        <select
          style={{ ...inputStyle, fontSize: 11 }}
          value={action.pageId}
          onChange={(e) => {
            onUpdate({ ...action, pageId: e.target.value })
          }}
        >
          <option value="">— select page —</option>
          {pageIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      )}

      {action.category === 'dashboard' && action.type === 'set_theme' && (
        <input
          style={{ ...inputStyle, fontSize: 11 }}
          placeholder="theme ID"
          value={action.themeId}
          onChange={(e) => {
            onUpdate({ ...action, themeId: e.target.value })
          }}
        />
      )}

      {action.category === 'ecu' && action.type === 'map_switch' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: '#666666' }}>Map</span>
          <input
            type="number"
            min={1}
            max={8}
            style={{ ...numberInputStyle, width: 50 }}
            value={action.mapIndex}
            onChange={(e) => {
              onUpdate({ ...action, mapIndex: Number(e.target.value) })
            }}
          />
        </div>
      )}

      {action.category === 'ecu' && action.type === 'can_raw' && (
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: '0 0 70px' }}>
            <div style={{ fontSize: 9, color: '#555555', marginBottom: 2 }}>FRAME ID</div>
            <input
              style={{ ...inputStyle, fontSize: 10 }}
              placeholder="0x123"
              value={`0x${action.frameId.toString(16).toUpperCase()}`}
              onChange={(e) => {
                const v = parseInt(e.target.value, 16)
                if (!isNaN(v)) onUpdate({ ...action, frameId: v })
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: '#555555', marginBottom: 2 }}>DATA (HEX)</div>
            <input
              style={{ ...inputStyle, fontSize: 10, fontFamily: 'monospace' }}
              placeholder="0102030405060708"
              value={action.data}
              onChange={(e) => {
                onUpdate({ ...action, data: e.target.value })
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Add action menu
// ---------------------------------------------------------------------------

function AddActionMenu({
  pageIds,
  onAdd,
}: {
  pageIds: string[]
  onAdd: (a: ButtonAction) => void
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
      {[
        {
          label: 'Navigate',
          action: (): ButtonAction => ({
            category: 'dashboard',
            type: 'navigate',
            pageId: pageIds[0] ?? '',
          }),
          color: '#5577CC',
        },
        {
          label: 'Map Switch',
          action: (): ButtonAction => ({ category: 'ecu', type: 'map_switch', mapIndex: 1 }),
          color: '#CC8800',
        },
        {
          label: 'CAN Raw',
          action: (): ButtonAction => ({ category: 'ecu', type: 'can_raw', frameId: 0, data: '' }),
          color: '#CC8800',
        },
        {
          label: 'Set Theme',
          action: (): ButtonAction => ({
            category: 'dashboard',
            type: 'set_theme',
            themeId: '',
          }),
          color: '#5577CC',
        },
      ].map(({ label, action, color }) => (
        <button
          key={label}
          onClick={() => {
            onAdd(action())
          }}
          style={{
            fontSize: 10,
            padding: '2px 7px',
            background: 'transparent',
            border: `1px solid ${color}44`,
            borderRadius: 3,
            color: color,
            cursor: 'pointer',
          }}
        >
          + {label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Button widget fields
// ---------------------------------------------------------------------------

function ButtonFields({ widget, onChange }: ConfigFieldsProps) {
  const cfg = widget.config.type === 'button' ? widget.config : null
  const pages = useDashboardStore((s) => s.config?.pages ?? [])
  const pageIds = pages.map((p) => p.id)
  const [previewActive, setPreviewActive] = useState(false)

  if (!cfg) return null

  const updateAction = (idx: number, updated: ButtonAction) => {
    const next = cfg.actions.map((a, i) => (i === idx ? updated : a))
    onChange({ config: { ...cfg, actions: next } })
  }

  const removeAction = (idx: number) => {
    onChange({ config: { ...cfg, actions: cfg.actions.filter((_, i) => i !== idx) } })
  }

  const addAction = (action: ButtonAction) => {
    onChange({ config: { ...cfg, actions: [...cfg.actions, action] } })
  }

  const { w, h } = widget.layout
  const PREVIEW_SCALE = 2

  return (
    <>
      {/* Active state preview */}
      <Field label="Active state">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <div
            style={{
              border: `1px solid ${previewActive ? widget.style.primaryColor : '#2A2A2A'}`,
              borderRadius: 3,
              overflow: 'hidden',
              display: 'inline-block',
            }}
          >
            <WidgetPreview
              widget={widget}
              displayW={w * PREVIEW_SCALE}
              displayH={h * PREVIEW_SCALE}
              buttonActive={previewActive}
            />
          </div>
          <button
            onClick={() => {
              setPreviewActive((v) => !v)
            }}
            style={{
              fontSize: 10,
              padding: '3px 8px',
              background: previewActive ? '#2A1A1A' : 'transparent',
              border: `1px solid ${previewActive ? '#AA3333' : '#2A2A2A'}`,
              borderRadius: 3,
              color: previewActive ? '#FF4444' : '#555555',
              cursor: 'pointer',
            }}
          >
            {previewActive ? 'Active' : 'Idle'}
          </button>
        </div>
      </Field>

      <Field label="Mode">
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: '#AAAAAA',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={cfg.isToggle === true}
            onChange={(e) => {
              onChange({ config: { ...cfg, isToggle: e.target.checked } })
            }}
          />
          Toggle (stays active after press)
        </label>
      </Field>

      <Field label="Label">
        <input
          style={inputStyle}
          value={cfg.label}
          onChange={(e) => {
            onChange({ config: { ...cfg, label: e.target.value } })
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

      <div
        style={{
          fontSize: 10,
          color: '#444444',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 5,
          marginTop: 4,
        }}
      >
        Actions
      </div>

      {cfg.actions.length === 0 && (
        <div style={{ fontSize: 11, color: '#444444', marginBottom: 6 }}>No actions yet.</div>
      )}

      {cfg.actions.map((action, idx) => (
        <ActionRow
          key={idx}
          action={action}
          pageIds={pageIds}
          onUpdate={(updated) => {
            updateAction(idx, updated)
          }}
          onRemove={() => {
            removeAction(idx)
          }}
        />
      ))}

      <AddActionMenu pageIds={pageIds} onAdd={addAction} />
    </>
  )
}

function BarFields({ widget, onChange }: ConfigFieldsProps) {
  const cfg = widget.config.type === 'bar' ? widget.config : null
  if (!cfg) return null
  return (
    <>
      <Field label="Unit">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 4 }}>
          {COMMON_UNITS.map((u) => (
            <button
              key={u}
              onClick={() => {
                const next = { ...cfg }
                if (cfg.suffix === u) delete next.suffix
                else next.suffix = u
                onChange({ config: next })
              }}
              style={{
                padding: '2px 6px',
                fontSize: 10,
                background: cfg.suffix === u ? '#1A2A1A' : '#111111',
                border: `1px solid ${cfg.suffix === u ? '#448844' : '#2A2A2A'}`,
                borderRadius: 3,
                color: cfg.suffix === u ? '#66AA66' : '#555555',
                cursor: 'pointer',
              }}
            >
              {u}
            </button>
          ))}
        </div>
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
      </Field>
      <Field label="Label">
        <input
          style={inputStyle}
          placeholder="e.g. TPS, Throttle…"
          value={cfg.label ?? ''}
          onChange={(e) => {
            const next = { ...cfg }
            if (e.target.value) next.label = e.target.value
            else delete next.label
            onChange({ config: next })
          }}
        />
      </Field>
      {cfg.label && (
        <Field label="Label pos.">
          <div style={{ display: 'flex', gap: 3 }}>
            {(['top-center', 'bottom-center'] as const).map((pos) => {
              const isActive = (cfg.labelPosition ?? 'bottom-center') === pos
              return (
                <button
                  key={pos}
                  onClick={() => {
                    onChange({ config: { ...cfg, labelPosition: pos } })
                  }}
                  style={{
                    flex: 1,
                    padding: '3px 0',
                    fontSize: 10,
                    background: isActive ? '#2A2A3A' : '#111111',
                    border: `1px solid ${isActive ? '#5566AA' : '#2A2A2A'}`,
                    borderRadius: 3,
                    color: isActive ? '#7788CC' : '#555555',
                    cursor: 'pointer',
                  }}
                >
                  {pos === 'top-center' ? '↑ Top' : '↓ Bottom'}
                </button>
              )
            })}
          </div>
        </Field>
      )}
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

      {/* Signal binding — not applicable for button, timer, image */}
      {widget.type !== 'button' && widget.type !== 'timer' && widget.type !== 'image' && (
        <Field label="Signal">
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={widget.signal}
            onChange={(e) => {
              const newSignal = e.target.value
              const signalDef = signals.find((s) => s.name === newSignal)
              const p: Partial<Widget> = { signal: newSignal }
              // Auto-fill unit suffix from signal definition
              if (
                signalDef?.unit &&
                (widget.config.type === 'gauge' || widget.config.type === 'bar')
              ) {
                p.config = { ...widget.config, suffix: signalDef.unit }
              }
              patch(p)
            }}
          >
            <option value="">— none —</option>
            {signals.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
                {s.unit ? ` (${s.unit})` : ''}
              </option>
            ))}
          </select>
        </Field>
      )}

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

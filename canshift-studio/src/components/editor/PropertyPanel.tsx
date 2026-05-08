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
import { DAY_THEME_PRESET } from '../../constants/theme'
import { useDashboardStore } from '../../stores/dashboard.store'
import { useSignalStore } from '../../stores/signal.store'
import { SensorIcon, SENSOR_ICON_NAMES, SENSOR_ICON_LABELS } from '../icons/SensorIcons'
import { IconTrash } from '../icons/Icon'
import { WidgetPreview } from './WidgetPreview'
import {
  SIZE_TOKENS,
  STANDARD_TOKEN_IDS,
  gaugeTokenIds,
  GAUGE_DEFAULT_TOKEN,
  tokenFromDimensions,
} from '../../utils/sizeTokens'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Field({
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
// Config-specific fields
// ---------------------------------------------------------------------------

interface ConfigFieldsProps {
  widget: Widget
  onChange: (patch: Partial<Widget>) => void
  /** Definition for the bound signal (when one is bound) — used to resolve "reset to default". */
  signalDef?: import('@tmbk/canshift-core').SignalDef | undefined
}

const GAUGE_STYLES: { value: GaugeDisplayStyle; label: string }[] = [
  { value: 'arc', label: 'Arc' },
  { value: 'bar', label: 'Bar' },
  { value: 'numeric', label: 'Numeric' },
]

// All automotive units available as quick chips
const ALL_UNITS = ['rpm', 'km/h', 'mph', '%', '°C', '°F', 'bar', 'psi', 'V', 'λ', 'AFR', 'kPa', 's']

// Units relevant to each signal — restricts the chips shown when a signal is bound
const SIGNAL_UNITS: Record<string, string[]> = {
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

// Label position options shared by every widget that exposes a corner label.
const GAUGE_LABEL_POSITIONS: { value: WidgetLabelPosition; label: string }[] = [
  { value: 'top-left', label: '↖ TL' },
  { value: 'top-right', label: '↗ TR' },
  { value: 'bottom-left', label: '↙ BL' },
  { value: 'bottom-right', label: '↘ BR' },
]

// Reusable label / labelPosition editor block — used by every widget editor
// that supports a corner label (gauge, bar, warning, timer, gear, image).
interface LabelEditableConfig {
  label?: string
  labelPosition?: WidgetLabelPosition
}

function LabelFields<T extends LabelEditableConfig>({
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
                    background: isActive ? '#2A2A3A' : '#111111',
                    border: `1px solid ${isActive ? '#5566AA' : '#2A2A2A'}`,
                    borderRadius: 3,
                    color: isActive ? '#7788CC' : '#AAAAAA',
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

function GaugeFields({ widget, onChange, signalDef }: ConfigFieldsProps) {
  const cfg = widget.config.type === 'gauge' ? widget.config : null
  if (!cfg) return null
  const style = cfg.displayStyle
  // Pre-narrowed defaults — TypeScript can't follow signalDef?.X through the
  // chained ternaries inside the JSX, so we hoist the values once.
  const defaultWarn = signalDef?.warningLevel
  const defaultDanger = signalDef?.dangerLevel
  const barOrientation = cfg.barOrientation ?? 'vertical'
  const allowedTokenIds = gaugeTokenIds(style, barOrientation)
  // If current dimensions don't match any token, fall back to the first available
  const activeTokenId =
    tokenFromDimensions(widget.layout.w, widget.layout.h) ?? allowedTokenIds[0] ?? null

  // Units filtered to what makes sense for the bound signal
  const signalUnits = widget.signal ? SIGNAL_UNITS[widget.signal] : undefined
  const unitList = signalUnits ?? ALL_UNITS

  return (
    <>
      {/* Display style selector — switching also applies the default size token */}
      <Field label="Style">
        <div style={{ display: 'flex', gap: 4 }}>
          {GAUGE_STYLES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => {
                const defaultTokenId = GAUGE_DEFAULT_TOKEN[value]
                const defaultToken = SIZE_TOKENS[defaultTokenId]
                onChange({
                  config: { ...cfg, displayStyle: value },
                  layout: { ...widget.layout, w: defaultToken.w, h: defaultToken.h },
                })
              }}
              style={{
                flex: 1,
                padding: '3px 0',
                background: style === value ? '#2A2A3A' : '#111111',
                border: `1px solid ${style === value ? '#5566AA' : '#2A2A2A'}`,
                borderRadius: 3,
                color: style === value ? '#7788CC' : '#AAAAAA',
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

      {/* Size tokens for the current style */}
      <Field label="Size">
        <div style={{ display: 'flex', gap: 4 }}>
          {allowedTokenIds.map((tokenId) => {
            const token = SIZE_TOKENS[tokenId]
            const isActive = tokenId === activeTokenId
            return (
              <button
                key={tokenId}
                onClick={() => {
                  onChange({ layout: { ...widget.layout, w: token.w, h: token.h } })
                }}
                title={token.description}
                style={{
                  flex: 1,
                  padding: '3px 0',
                  background: isActive ? '#1A2A1A' : '#111111',
                  border: `1px solid ${isActive ? '#448844' : '#2A2A2A'}`,
                  borderRadius: 3,
                  color: isActive ? '#66AA66' : '#AAAAAA',
                  cursor: 'pointer',
                  fontSize: 10,
                  fontWeight: isActive ? 700 : 400,
                }}
              >
                {token.label}
              </button>
            )
          })}
        </div>
      </Field>

      {/* Unit / suffix */}
      <Field label="Unit">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 4 }}>
          {unitList.map((u) => {
            const isActive = cfg.suffix === u
            return (
              <button
                key={u}
                onClick={() => {
                  const next = { ...cfg }
                  if (isActive) delete next.suffix
                  else next.suffix = u
                  onChange({ config: next })
                }}
                style={{
                  padding: '2px 6px',
                  fontSize: 10,
                  background: isActive ? '#1A2A1A' : '#111111',
                  border: `1px solid ${isActive ? '#448844' : '#2A2A2A'}`,
                  borderRadius: 3,
                  color: isActive ? '#66AA66' : '#AAAAAA',
                  cursor: 'pointer',
                }}
              >
                {u}
              </button>
            )
          })}
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

      {/* Bar orientation — switches to the default token for the new orientation */}
      {style === 'bar' && (
        <Field label="Orientation">
          <div style={{ display: 'flex', gap: 4 }}>
            {(['vertical', 'horizontal'] as const).map((dir) => {
              const isActive = barOrientation === dir
              return (
                <button
                  key={dir}
                  onClick={() => {
                    const newTokenId = dir === 'horizontal' ? 'H-FULL' : 'V-M'
                    const newToken = SIZE_TOKENS[newTokenId]
                    onChange({
                      config: { ...cfg, barOrientation: dir },
                      layout: { ...widget.layout, w: newToken.w, h: newToken.h },
                    })
                  }}
                  style={{
                    flex: 1,
                    padding: '3px 0',
                    background: isActive ? '#2A2A3A' : '#111111',
                    border: `1px solid ${isActive ? '#5566AA' : '#2A2A2A'}`,
                    borderRadius: 3,
                    color: isActive ? '#7788CC' : '#AAAAAA',
                    cursor: 'pointer',
                    fontSize: 10,
                    textTransform: 'uppercase',
                  }}
                >
                  {dir === 'vertical' ? '↕ V' : '↔ H'}
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
            <Field
              label="Min"
              onReset={
                signalDef && cfg.minValue !== signalDef.min
                  ? () => {
                      onChange({ config: { ...cfg, minValue: signalDef.min } })
                    }
                  : undefined
              }
            >
              <input
                type="number"
                style={numberInputStyle}
                value={cfg.minValue}
                onChange={(e) => {
                  const newMin = Number(e.target.value)
                  onChange({
                    config: {
                      ...cfg,
                      minValue: newMin,
                      warningLevel: Math.max(cfg.warningLevel, newMin),
                      dangerLevel: Math.max(cfg.dangerLevel, newMin),
                    },
                  })
                }}
              />
            </Field>
            <Field
              label="Max"
              onReset={
                signalDef && cfg.maxValue !== signalDef.max
                  ? () => {
                      onChange({ config: { ...cfg, maxValue: signalDef.max } })
                    }
                  : undefined
              }
            >
              <input
                type="number"
                style={numberInputStyle}
                value={cfg.maxValue}
                onChange={(e) => {
                  const newMax = Number(e.target.value)
                  // Scale warn/danger proportionally when max changes
                  const range = cfg.maxValue - cfg.minValue || 1
                  const warnPct = (cfg.warningLevel - cfg.minValue) / range
                  const dangerPct = (cfg.dangerLevel - cfg.minValue) / range
                  const newRange = newMax - cfg.minValue || 1
                  onChange({
                    config: {
                      ...cfg,
                      maxValue: newMax,
                      warningLevel: Math.round(cfg.minValue + warnPct * newRange),
                      dangerLevel: Math.round(cfg.minValue + dangerPct * newRange),
                    },
                  })
                }}
              />
            </Field>
          </Row>
          <Row>
            <Field
              label="Warn"
              onReset={
                defaultWarn !== undefined && cfg.warningLevel !== defaultWarn
                  ? () => {
                      onChange({ config: { ...cfg, warningLevel: defaultWarn } })
                    }
                  : undefined
              }
            >
              <input
                type="number"
                style={numberInputStyle}
                value={cfg.warningLevel}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  onChange({
                    config: {
                      ...cfg,
                      warningLevel: Math.min(v, cfg.dangerLevel),
                    },
                  })
                }}
              />
            </Field>
            <Field
              label="Danger"
              onReset={
                defaultDanger !== undefined && cfg.dangerLevel !== defaultDanger
                  ? () => {
                      onChange({ config: { ...cfg, dangerLevel: defaultDanger } })
                    }
                  : undefined
              }
            >
              <input
                type="number"
                style={numberInputStyle}
                value={cfg.dangerLevel}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  onChange({
                    config: {
                      ...cfg,
                      dangerLevel: Math.max(v, cfg.warningLevel),
                    },
                  })
                }}
              />
            </Field>
          </Row>
          {style === 'arc' && (
            <>
              <Field label="Fill style">
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['zones', 'gradient'] as const).map((fill) => {
                    const activeFill = cfg.arcFillStyle ?? 'zones'
                    const isActive = activeFill === fill
                    return (
                      <button
                        key={fill}
                        onClick={() => {
                          const next = { ...cfg }
                          if (fill === 'zones') {
                            // Drop the field so legacy configs stay clean.
                            delete next.arcFillStyle
                          } else {
                            next.arcFillStyle = fill
                          }
                          onChange({ config: next })
                        }}
                        style={{
                          flex: 1,
                          padding: '3px 0',
                          background: isActive ? '#2A2A3A' : '#111111',
                          border: `1px solid ${isActive ? '#5566AA' : '#2A2A2A'}`,
                          borderRadius: 3,
                          color: isActive ? '#7788CC' : '#AAAAAA',
                          cursor: 'pointer',
                          fontSize: 10,
                          textTransform: 'uppercase',
                        }}
                      >
                        {fill === 'zones' ? 'Zones' : 'Gradient'}
                      </button>
                    )
                  })}
                </div>
              </Field>
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
          <Row>
            <Field
              label="Alert at"
              onReset={
                cfg.alertThreshold !== undefined
                  ? () => {
                      const { alertThreshold: _drop, ...rest } = cfg
                      void _drop
                      onChange({ config: rest })
                    }
                  : undefined
              }
            >
              <input
                type="number"
                style={numberInputStyle}
                placeholder="off"
                value={cfg.alertThreshold ?? ''}
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw === '') {
                    const { alertThreshold: _drop, ...rest } = cfg
                    void _drop
                    onChange({ config: rest })
                    return
                  }
                  const v = Number(raw)
                  if (!Number.isFinite(v)) return
                  onChange({ config: { ...cfg, alertThreshold: v } })
                }}
              />
            </Field>
          </Row>
        </>
      )}

      {/* Widget label */}
      <LabelFields
        cfg={cfg}
        onChange={(next) => {
          onChange({ config: next })
        }}
      />
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
      ? 'Navigate'
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
      {action.category === 'dashboard' && (
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
            <div style={{ fontSize: 9, color: '#AAAAAA', marginBottom: 2 }}>FRAME ID</div>
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
            <div style={{ fontSize: 9, color: '#AAAAAA', marginBottom: 2 }}>DATA (HEX)</div>
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
              color: previewActive ? '#FF4444' : '#AAAAAA',
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
          color: '#AAAAAA',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 5,
          marginTop: 4,
        }}
      >
        Actions
      </div>

      {cfg.actions.length === 0 && (
        <div style={{ fontSize: 11, color: '#AAAAAA', marginBottom: 6 }}>No actions yet.</div>
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
          {ALL_UNITS.map((u) => (
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
                color: cfg.suffix === u ? '#66AA66' : '#AAAAAA',
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
                    color: isActive ? '#7788CC' : '#AAAAAA',
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
      <LabelFields
        cfg={cfg}
        onChange={(next) => {
          onChange({ config: next })
        }}
      />
    </>
  )
}

function TimerFields({ widget, onChange }: ConfigFieldsProps) {
  const cfg = widget.config.type === 'timer' ? widget.config : null
  if (!cfg) return null
  return (
    <>
      <Field label="Format">
        <div style={{ display: 'flex', gap: 3 }}>
          {(['mm:ss', 'ss.mmm'] as const).map((fmt) => {
            const isActive = (cfg.format ?? 'mm:ss') === fmt
            return (
              <button
                key={fmt}
                onClick={() => {
                  onChange({ config: { ...cfg, format: fmt } })
                }}
                style={{
                  flex: 1,
                  padding: '3px 0',
                  fontSize: 10,
                  background: isActive ? '#2A2A3A' : '#111111',
                  border: `1px solid ${isActive ? '#5566AA' : '#2A2A2A'}`,
                  borderRadius: 3,
                  color: isActive ? '#7788CC' : '#AAAAAA',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                {fmt}
              </button>
            )
          })}
        </div>
      </Field>
      <Field label="Auto-start">
        <input
          type="checkbox"
          checked={cfg.autoStart ?? false}
          onChange={(e) => {
            onChange({ config: { ...cfg, autoStart: e.target.checked } })
          }}
        />
      </Field>
      <LabelFields
        cfg={cfg}
        onChange={(next) => {
          onChange({ config: next })
        }}
      />
    </>
  )
}

function GearFields({ widget, onChange }: ConfigFieldsProps) {
  const cfg = widget.config.type === 'gear' ? widget.config : null
  if (!cfg) return null
  return (
    <>
      <Field label="Hide if invalid">
        <input
          type="checkbox"
          checked={cfg.hideWhenInvalid ?? false}
          onChange={(e) => {
            onChange({ config: { ...cfg, hideWhenInvalid: e.target.checked } })
          }}
        />
      </Field>
      <LabelFields
        cfg={cfg}
        onChange={(next) => {
          onChange({ config: next })
        }}
      />
    </>
  )
}

function ImageFields({ widget, onChange }: ConfigFieldsProps) {
  const cfg = widget.config.type === 'image' ? widget.config : null
  if (!cfg) return null
  return (
    <>
      <Field label="Path">
        <input
          style={inputStyle}
          placeholder="/images/logo.bin"
          value={cfg.imagePath}
          onChange={(e) => {
            onChange({ config: { ...cfg, imagePath: e.target.value } })
          }}
        />
      </Field>
      <LabelFields
        cfg={cfg}
        onChange={(next) => {
          onChange({ config: next })
        }}
      />
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
  timer: TimerFields,
  gear: GearFields,
  image: ImageFields,
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
  const updateTopBar = useDashboardStore((s) => s.updateTopBar)
  const setDayTheme = useDashboardStore((s) => s.setDayTheme)
  const signals = useSignalStore((s) => s.signals)

  const page = config?.pages.find((p) => p.id === pageId)
  const widget = page?.widgets.find((w) => w.id === selectedWidgetId)

  // No widget selected → show page/theme settings
  if (!widget) {
    if (!page || !config) {
      return (
        <div style={{ padding: 12 }}>
          <p style={{ color: '#333333', fontSize: 11 }}>No config loaded.</p>
        </div>
      )
    }
    return (
      <div style={{ padding: 12, overflowY: 'auto', flex: 1 }}>
        <div
          style={{
            fontSize: 10,
            color: '#AAAAAA',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 10,
          }}
        >
          Page settings
        </div>

        {/* Day theme — stored in config root, enables ☀/☾ toggle on device */}
        <div
          style={{
            fontSize: 10,
            color: '#AAAAAA',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 6,
            marginTop: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>Day Theme</span>
          {config.dayTheme ? (
            <button
              onClick={() => {
                setDayTheme(null)
              }}
              title="Remove day theme (hides ☀/☾ toggle on device)"
              style={{
                fontSize: 9,
                padding: '1px 5px',
                background: 'none',
                border: '1px solid #3A1A1A',
                borderRadius: 3,
                color: '#AA3333',
                cursor: 'pointer',
              }}
            >
              remove
            </button>
          ) : (
            <button
              onClick={() => {
                setDayTheme(DAY_THEME_PRESET)
              }}
              title="Enable day mode toggle on device"
              style={{
                fontSize: 9,
                padding: '1px 5px',
                background: 'none',
                border: '1px solid #1A3A1A',
                borderRadius: 3,
                color: '#44AA44',
                cursor: 'pointer',
              }}
            >
              enable
            </button>
          )}
        </div>

        {!config.dayTheme && (
          <div style={{ fontSize: 10, color: '#444444', marginBottom: 8 }}>
            Not configured — device will not show ☀/☾ toggle.
          </div>
        )}

        <div
          style={{
            fontSize: 10,
            color: '#AAAAAA',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 6,
            marginTop: 8,
          }}
        >
          Top Bar
        </div>
        <Row>
          <Field label="Bar color">
            <input
              type="color"
              value={config.topBar.bgColor}
              style={{
                width: '100%',
                height: 28,
                padding: 2,
                background: '#111',
                border: '1px solid #333',
                borderRadius: 3,
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
              onChange={(e) => {
                updateTopBar({ bgColor: e.target.value as `#${string}` })
              }}
            />
          </Field>
          <Field label="Text color">
            <input
              type="color"
              value={config.topBar.textColor}
              style={{
                width: '100%',
                height: 28,
                padding: 2,
                background: '#111',
                border: '1px solid #333',
                borderRadius: 3,
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
              onChange={(e) => {
                updateTopBar({ textColor: e.target.value as `#${string}` })
              }}
            />
          </Field>
        </Row>
        <div style={{ fontSize: 10, color: '#333', marginTop: 12 }}>
          Select a widget to edit its properties.
        </div>
      </div>
    )
  }

  const patch = (p: Partial<Widget>) => {
    updateWidget(pageId, widget.id, p)
  }

  const ConfigFields = CONFIG_FIELDS[widget.type]
  const boundSignalDef = signals.find((s) => s.name === widget.signal)

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
              color: '#AAAAAA',
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
        <div style={{ fontSize: 10, color: '#AAAAAA', fontFamily: 'monospace', padding: '3px 0' }}>
          {widget.id}
        </div>
      </Field>

      {/* Size tokens — gauge has its own picker inside GaugeFields */}
      {widget.type !== 'gauge' && (
        <Field label="Size">
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {STANDARD_TOKEN_IDS.map((tokenId) => {
              const token = SIZE_TOKENS[tokenId]
              const isActive =
                tokenId ===
                (tokenFromDimensions(widget.layout.w, widget.layout.h) ??
                  STANDARD_TOKEN_IDS[0] ??
                  null)
              return (
                <button
                  key={tokenId}
                  onClick={() => {
                    patch({ layout: { ...widget.layout, w: token.w, h: token.h } })
                  }}
                  title={token.description}
                  style={{
                    flex: 1,
                    padding: '3px 0',
                    background: isActive ? '#1A2A1A' : '#111111',
                    border: `1px solid ${isActive ? '#448844' : '#2A2A2A'}`,
                    borderRadius: 3,
                    color: isActive ? '#66AA66' : '#AAAAAA',
                    cursor: 'pointer',
                    fontSize: 10,
                    fontWeight: isActive ? 700 : 400,
                  }}
                >
                  {token.label}
                </button>
              )
            })}
          </div>
        </Field>
      )}

      {/* Signal binding — not applicable for button, timer, image.
          Uses an <input list> + <datalist> for native filter-as-you-type
          search; the dropdown stays scrollable in browsers that support it. */}
      {widget.type !== 'button' && widget.type !== 'timer' && widget.type !== 'image' && (
        <Field label="Signal">
          <input
            type="text"
            list={`signals-list-${widget.id}`}
            style={inputStyle}
            value={widget.signal}
            placeholder="— search signals —"
            onChange={(e) => {
              const newSignal = e.target.value
              const signalDef = signals.find((s) => s.name === newSignal)
              const p: Partial<Widget> = { signal: newSignal }
              if (signalDef && widget.config.type === 'gauge') {
                p.config = {
                  ...widget.config,
                  suffix: signalDef.unit,
                  minValue: signalDef.min,
                  maxValue: signalDef.max,
                  ...(signalDef.warningLevel !== undefined && {
                    warningLevel: signalDef.warningLevel,
                  }),
                  ...(signalDef.dangerLevel !== undefined && {
                    dangerLevel: signalDef.dangerLevel,
                  }),
                }
              } else if (signalDef && widget.config.type === 'bar') {
                p.config = {
                  ...widget.config,
                  suffix: signalDef.unit,
                  minValue: signalDef.min,
                  maxValue: signalDef.max,
                  ...(signalDef.warningLevel !== undefined && {
                    warningLevel: signalDef.warningLevel,
                  }),
                  ...(signalDef.dangerLevel !== undefined && {
                    dangerLevel: signalDef.dangerLevel,
                  }),
                }
              }
              patch(p)
            }}
          />
          <datalist id={`signals-list-${widget.id}`}>
            {signals.map((s) => (
              <option key={s.name} value={s.name}>
                {s.unit}
              </option>
            ))}
          </datalist>
        </Field>
      )}

      {/* Button states — only buttons expose colour pickers (#146).
          Normal = idle state, Active = pressed / hover / triggered. */}
      {widget.type === 'button' && widget.config.type === 'button' && (
        <>
          <div
            style={{
              fontSize: 10,
              color: '#AAAAAA',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 6,
              marginTop: 4,
            }}
          >
            Button colors
          </div>
          {(() => {
            const cfg = widget.config
            const normal = cfg.colors?.normal ?? widget.style.primaryColor
            const active = cfg.colors?.active ?? widget.style.primaryColor
            return (
              <Row>
                <Field label="Normal">
                  <input
                    type="color"
                    value={normal}
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
                      const next = {
                        normal: e.target.value as `#${string}`,
                        active: cfg.colors?.active ?? (e.target.value as `#${string}`),
                      }
                      patch({ config: { ...cfg, colors: next } })
                    }}
                  />
                </Field>
                <Field label="Active">
                  <input
                    type="color"
                    value={active}
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
                      const next = {
                        normal: cfg.colors?.normal ?? (e.target.value as `#${string}`),
                        active: e.target.value as `#${string}`,
                      }
                      patch({ config: { ...cfg, colors: next } })
                    }}
                  />
                </Field>
              </Row>
            )
          })()}
        </>
      )}

      {/* Type-specific config */}
      {ConfigFields && (
        <>
          <div
            style={{
              fontSize: 10,
              color: '#AAAAAA',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 6,
              marginTop: 4,
            }}
          >
            {widget.type} config
          </div>
          <ConfigFields widget={widget} onChange={patch} signalDef={boundSignalDef} />
        </>
      )}
    </div>
  )
}

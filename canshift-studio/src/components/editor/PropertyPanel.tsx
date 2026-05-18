// PropertyPanel.tsx — Editor for the selected widget's properties.
// Layout (x, y, w, h), signal binding, style, and type-specific config.
//
// Per-widget config editors live in `./property-panel/*-fields.tsx`. This
// file owns the page-level fallback view, the cross-widget chrome (size,
// signal binding, button colors), and the dispatch to the right widget
// editor (#697).

import type { Widget, WidgetType } from '@tmbk/canshift-core'
import { useDashboardStore } from '../../stores/dashboard.store'
import { useSignalStore } from '../../stores/signal.store'
import { IconTrash } from '../icons/Icon'
import { SIZE_TOKENS, STANDARD_TOKEN_IDS, tokenFromDimensions } from '../../utils/sizeTokens'
import { ConfigFieldsProps, Field, Row, inputStyle } from './property-panel/shared'
import { GaugeFields } from './property-panel/gauge-fields'
import { ButtonFields } from './property-panel/button-fields'
import { BarFields } from './property-panel/bar-fields'
import { WarningFields } from './property-panel/warning-fields'
import { TimerFields } from './property-panel/timer-fields'
import { GearFields } from './property-panel/gear-fields'
import { ImageFields } from './property-panel/image-fields'

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

interface PropertyPanelProps {
  pageId: string
}

export default function PropertyPanel({ pageId }: PropertyPanelProps) {
  const config = useDashboardStore((s) => s.config)
  const selectedWidgetId = useDashboardStore((s) => s.selectedWidgetId)
  const updateWidget = useDashboardStore((s) => s.updateWidget)
  const removeWidget = useDashboardStore((s) => s.removeWidget)
  const updateTopBar = useDashboardStore((s) => s.updateTopBar)
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

      {/* Day-mode text colour override (#191).
          Toggling this off keeps the widget's bespoke `style.textColor` in
          day mode instead of collapsing to the active theme's black. */}
      <Field label="Follow day-mode text colour">
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
            checked={widget.style.respectDayMode !== false}
            onChange={(e) => {
              const nextStyle = { ...widget.style }
              if (e.target.checked) {
                // Default behaviour — drop the explicit flag so legacy
                // configs round-trip unchanged.
                delete nextStyle.respectDayMode
              } else {
                nextStyle.respectDayMode = false
              }
              patch({ style: nextStyle })
            }}
          />
          When off, the widget keeps its bespoke text colour in day mode
        </label>
      </Field>

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

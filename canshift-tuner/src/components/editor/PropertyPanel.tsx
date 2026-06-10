import { useState } from 'react'
import type { HexColor, ScreenProfileId, Widget, WidgetType } from '@tmbk/canshift-core'
import {
  DEFAULT_PAGE_PALETTE,
  DEFAULT_SCREEN_PROFILE_ID,
  FIRMWARE_CAPS,
  HexColorSchema,
  SCREEN_PROFILES,
} from '@tmbk/canshift-core'
import { useCallback } from 'react'
import { useDashboardConfig } from '../../hooks/useDashboardConfig'
import { useSignalStore } from '../../stores/signal.store'
import { useLogStore } from '../../stores/log.store'
import { IconTrash } from '../icons/Icon'
import { SIZE_TOKENS, STANDARD_TOKEN_IDS, tokenFromDimensions } from '../../utils/sizeTokens'
import { ConfigFieldsProps, Field, Row, inputStyle } from './property-panel/shared'
import { GaugeFields } from './property-panel/gauge-fields'
import { ButtonFields } from './property-panel/button-fields'

const PANEL_LABEL = '#AAAAAA'
const PANEL_HINT = '#333333'
const TYPE_BADGE = '#CC4444'
const DELETE_FG = '#AA3333'
const INPUT_BG = '#111111'
const INPUT_BORDER = '#333333'
const TOKEN_TILE_BG = '#111111'
const TOKEN_TILE_BORDER = '#2A2A2A'
const TOKEN_TILE_ACTIVE_BG = '#1A2A1A'
const TOKEN_TILE_ACTIVE_BORDER = '#448844'
const TOKEN_TILE_ACTIVE_FG = '#66AA66'

const CONFIG_FIELDS: Partial<
  Record<WidgetType, (props: ConfigFieldsProps) => React.JSX.Element | null>
> = {
  gauge: GaugeFields,
  button: ButtonFields,
}

interface PropertyPanelProps {
  pageId: string
}

const CRUISE_CONTROL_PAGE_ID = 'cruise_control'

export default function PropertyPanel({ pageId }: PropertyPanelProps) {
  const {
    config,
    selectedWidgetId,
    updateWidget,
    removeWidget,
    addPage,
    removePage,
    setTargetProfile,
  } = useDashboardConfig()
  const signals = useSignalStore((s) => s.signals)
  const pushLog = useLogStore((s) => s.push)
  const [colorError, setColorError] = useState<string | null>(null)

  const safeParseHex = (raw: string): HexColor | null => {
    const result = HexColorSchema.safeParse(raw)
    if (result.success) {
      setColorError(null)
      return result.data
    }
    const message = `Invalid color value "${raw}" — expected #RRGGBB hex literal.`
    setColorError(message)
    pushLog('warn', message)
    return null
  }

  const toggleCruiseControlPage = useCallback(
    (enabled: boolean) => {
      if (!config) return
      const existing = config.pages.find((p) => p.template === 'cruise_control')
      if (enabled && !existing) {
        if (config.pages.length >= FIRMWARE_CAPS.MAX_PAGES) {
          const list = config.pages.map((p, i) => `  ${(i + 1).toString()}. ${p.id}`).join('\n')
          window.alert(
            `You already have ${config.pages.length.toString()} pages — the firmware accepts at most ${FIRMWARE_CAPS.MAX_PAGES.toString()}. ` +
              'Remove a page first, then enable cruise control.\n\n' +
              `Current pages:\n${list}`
          )
          return
        }
        addPage({
          id: CRUISE_CONTROL_PAGE_ID,
          backgroundImage: null,
          backgroundColor: HexColorSchema.parse('#000000'),
          palette: DEFAULT_PAGE_PALETTE,
          showTopBar: true,
          template: 'cruise_control',
          widgets: [],
        })
      } else if (!enabled && existing) {
        removePage(existing.id)
      }
    },
    [config, addPage, removePage]
  )

  const page = config?.pages.find((p) => p.id === pageId)
  const widget = page?.widgets.find((w) => w.id === selectedWidgetId)
  const widgetId = widget?.id

  const patch = useCallback(
    (p: Partial<Widget>) => {
      if (!widgetId) return
      updateWidget(pageId, widgetId, p)
    },
    [updateWidget, pageId, widgetId]
  )

  if (!widget) {
    if (!page || !config) {
      return (
        <div style={{ padding: 12 }}>
          <p style={{ color: PANEL_HINT, fontSize: 11 }}>No config loaded.</p>
        </div>
      )
    }
    const activeProfileId: ScreenProfileId = config.targetProfile ?? DEFAULT_SCREEN_PROFILE_ID
    return (
      <div style={{ padding: 12, overflowY: 'auto', flex: 1 }}>
                <div
          style={{
            fontSize: 10,
            color: PANEL_LABEL,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 6,
          }}
        >
          Target screen
        </div>
        <select
          aria-label="Target screen profile"
          value={activeProfileId}
          onChange={(e) => {
            setTargetProfile(e.target.value as ScreenProfileId)
          }}
          style={{
            width: '100%',
            background: '#111111',
            border: '1px solid #333333',
            borderRadius: 3,
            color: 'hsl(var(--text))',
            fontSize: 11,
            padding: '4px 6px',
          }}
        >
          {SCREEN_PROFILES.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name} — {String(profile.width)}×{String(profile.height)}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 10, color: PANEL_HINT, marginTop: 4, marginBottom: 4 }}>
          Drives the editor canvas size. Widgets are not auto-scaled — out-of-bounds widgets are
          flagged on the canvas so you can adjust manually.
        </div>

                <div
          style={{
            fontSize: 10,
            color: PANEL_LABEL,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 6,
            marginTop: 12,
          }}
        >
          Modes
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11,
            color: 'hsl(var(--text))',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <input
            type="checkbox"
            checked={config.pages.some((p) => p.template === 'cruise_control')}
            onChange={(e) => {
              toggleCruiseControlPage(e.target.checked)
            }}
          />
          Cruise control page
        </label>
        <div style={{ fontSize: 10, color: PANEL_HINT, marginTop: 4, marginBottom: 4 }}>
          Adds a dedicated cruise control page at the end of the dashboard.
        </div>

        <div style={{ fontSize: 10, color: PANEL_HINT, marginTop: 12 }}>
          Select a widget to edit its properties.
        </div>
      </div>
    )
  }

  const ConfigFields = CONFIG_FIELDS[widget.type]
  const boundSignalDef = signals.find((s) => s.name === widget.signal)

  return (
    <div style={{ padding: 12, overflowY: 'auto', flex: 1 }}>
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
              color: PANEL_LABEL,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Properties
          </div>
          <div style={{ fontSize: 12, color: TYPE_BADGE, fontWeight: 600, marginTop: 2 }}>
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
            border: '1px solid hsl(var(--status-danger-dim))',
            borderRadius: 3,
            color: DELETE_FG,
            cursor: 'pointer',
            fontSize: 11,
            padding: '3px 7px',
          }}
        >
          <IconTrash size={11} color={DELETE_FG} />
          Delete
        </button>
      </div>

            <Field label="ID">
        <div
          style={{ fontSize: 10, color: PANEL_LABEL, fontFamily: 'monospace', padding: '3px 0' }}
        >
          {widget.id}
        </div>
      </Field>

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
                    background: isActive ? TOKEN_TILE_ACTIVE_BG : TOKEN_TILE_BG,
                    border: `1px solid ${isActive ? TOKEN_TILE_ACTIVE_BORDER : TOKEN_TILE_BORDER}`,
                    borderRadius: 3,
                    color: isActive ? TOKEN_TILE_ACTIVE_FG : PANEL_LABEL,
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

            {widget.type !== 'button' && widget.type !== 'timer' && widget.type !== 'image' && (
        <Field label="Signal">
                    <select
            style={{ ...inputStyle, fontSize: 11, padding: '4px 6px' }}
            value={widget.signal || ''}
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
                  ...(signalDef.dangerLevel !== undefined && {
                    dangerLevel: signalDef.dangerLevel,
                  }),
                }
              }
              patch(p)
            }}
          >
            <option value="">— none —</option>
            {signals.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
                {s.unit ? ` — ${s.unit}` : ''}
              </option>
            ))}
          </select>
        </Field>
      )}

            <Field label="Follow day-mode text colour">
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: PANEL_LABEL,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={widget.style.respectDayMode !== false}
            onChange={(e) => {
              const nextStyle = { ...widget.style }
              if (e.target.checked) {
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

            {widget.type === 'button' && widget.config.type === 'button' && (
        <>
          <div
            style={{
              fontSize: 10,
              color: PANEL_LABEL,
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
                      background: INPUT_BG,
                      border: `1px solid ${INPUT_BORDER}`,
                      borderRadius: 3,
                      cursor: 'pointer',
                    }}
                    onChange={(e) => {
                      const parsed = safeParseHex(e.target.value)
                      if (parsed === null) return
                      const next = {
                        normal: parsed,
                        active: cfg.colors?.active ?? parsed,
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
                      background: INPUT_BG,
                      border: `1px solid ${INPUT_BORDER}`,
                      borderRadius: 3,
                      cursor: 'pointer',
                    }}
                    onChange={(e) => {
                      const parsed = safeParseHex(e.target.value)
                      if (parsed === null) return
                      const next = {
                        normal: cfg.colors?.normal ?? parsed,
                        active: parsed,
                      }
                      patch({ config: { ...cfg, colors: next } })
                    }}
                  />
                </Field>
              </Row>
            )
          })()}
          {colorError !== null && (
            <div
              role="alert"
              style={{
                fontSize: 10,
                color: TYPE_BADGE,
                marginTop: 4,
                marginBottom: 4,
              }}
            >
              {colorError}
            </div>
          )}
        </>
      )}

            {ConfigFields && (
        <>
          <div
            style={{
              fontSize: 10,
              color: PANEL_LABEL,
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

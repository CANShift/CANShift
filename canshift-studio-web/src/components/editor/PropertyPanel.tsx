// PropertyPanel.tsx — Editor for the selected widget's properties.
// Layout (x, y, w, h), signal binding, style, and type-specific config.
//
// Per-widget config editors live in `./property-panel/*-fields.tsx`. This
// file owns the page-level fallback view, the cross-widget chrome (size,
// signal binding, button colors), and the dispatch to the right widget
// editor (#697).

import { useState } from 'react'
import type { HexColor, ScreenProfileId, Widget, WidgetType } from '@tmbk/canshift-core'
import {
  DEFAULT_PAGE_PALETTE,
  DEFAULT_SCREEN_PROFILE_ID,
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

// Chrome shades that do not yet map to a core design token. Kept as named
// constants so the planned token promotion (audit S-H-5, umbrella #1015) only
// has to swap one place per shade. Documented in PR body as follow-up.
const PANEL_LABEL = '#AAAAAA' // MIRROR: between --text-dim (#BABABA) and --text-muted (#8F8F8F)
const PANEL_HINT = '#333333' // MIRROR: ≈ --border (#333333) repurposed as dim hint
const TYPE_BADGE = '#CC4444' // MIRROR: darker than --status-danger (#E03030), widget-type badge
const DELETE_FG = '#AA3333' // MIRROR: darker than --status-danger (#E03030), delete button
const INPUT_BG = '#111111' // MIRROR: between --scrim (#000000) and --bg (#121212), color-picker chrome
const INPUT_BORDER = '#333333' // MIRROR: ≈ --border (#333333)
const TOKEN_TILE_BG = '#111111' // MIRROR: same chrome as INPUT_BG for inactive size tiles
const TOKEN_TILE_BORDER = '#2A2A2A' // MIRROR: between --bg (#121212) and --surface (#1F1F1F)
const TOKEN_TILE_ACTIVE_BG = '#1A2A1A' // MIRROR: custom dim-green active chrome; no token match
const TOKEN_TILE_ACTIVE_BORDER = '#448844' // MIRROR: darker than --success (#00CC2A)
const TOKEN_TILE_ACTIVE_FG = '#66AA66' // MIRROR: dimmer green than --success

const CONFIG_FIELDS: Partial<
  Record<WidgetType, (props: ConfigFieldsProps) => React.JSX.Element | null>
> = {
  gauge: GaugeFields,
  button: ButtonFields,
  // gear / warning / timer / image have no editable config beyond layout +
  // signal binding now that custom labels were dropped (issue #1244).
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
  // Per-field inline error surfaced when a color-picker commit produces a value
  // that fails `HexColorSchema.parse` (R-7). Cleared on the next valid commit.
  const [colorError, setColorError] = useState<string | null>(null)

  // Parse the raw color-picker value through HexColorSchema before persisting.
  // Returns the validated `#RRGGBB` literal, or `null` on failure (and routes
  // the failure through the log store so debugging surfaces it). Replaces the
  // previous `as `#${string}`` cast that bypassed the schema entirely (R-7).
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

  // Memoised so checkbox `onChange` doesn't see a fresh closure every render
  // and the panel's child editor components keep their referential identity
  // (audit follow-up to #1207).
  const toggleCruiseControlPage = useCallback(
    (enabled: boolean) => {
      if (!config) return
      const existing = config.pages.find((p) => p.template === 'cruise_control')
      if (enabled && !existing) {
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

  // Memoised so the child config-field components (GaugeFields,
  // ButtonFields, …) keep their `onChange` reference stable across renders
  // (audit follow-up to #1207). Hoisted above the early-return so the hook
  // call order stays stable when no widget is selected; the wrapped
  // dispatcher is a no-op until `widgetId` resolves.
  const patch = useCallback(
    (p: Partial<Widget>) => {
      if (!widgetId) return
      updateWidget(pageId, widgetId, p)
    },
    [updateWidget, pageId, widgetId]
  )

  // No widget selected → show page/theme settings
  if (!widget) {
    if (!page || !config) {
      return (
        <div style={{ padding: 12 }}>
          <p style={{ color: PANEL_HINT, fontSize: 11 }}>No config loaded.</p>
        </div>
      )
    }
    // Active target screen profile — falls back to the default catalog entry
    // (320×240) for legacy dashboards that predate `targetProfile`. Issue #548.
    const activeProfileId: ScreenProfileId = config.targetProfile ?? DEFAULT_SCREEN_PROFILE_ID
    return (
      <div style={{ padding: 12, overflowY: 'auto', flex: 1 }}>
        {/* Target screen profile picker — drives the editor canvas dimensions
            and travels with the dashboard config (issue #548). The catalog
            ships a single entry today; new boards (#17 / #18) extend
            SCREEN_PROFILES and surface here automatically. */}
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

        {/* Cruise control — opt-in checkbox that ensures a `cruise_control`
            templated page exists at the end of the dashboard. The firmware
            draws this page procedurally (ignores widgets[]); studio just
            tracks its presence. Unchecking removes the page. */}
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

      {/* ID (read-only) */}
      <Field label="ID">
        <div
          style={{ fontSize: 10, color: PANEL_LABEL, fontFamily: 'monospace', padding: '3px 0' }}
        >
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

      {/* Signal binding — not applicable for button, timer, image.
          Uses an <input list> + <datalist> for native filter-as-you-type
          search; the dropdown stays scrollable in browsers that support it. */}
      {widget.type !== 'button' && widget.type !== 'timer' && widget.type !== 'image' && (
        <Field label="Signal">
          {/* Native <select> — dropped the Radix Select wrapper to shave
              ~25 KB gzip off the bundle. The widget→signal binding is the
              only complex picker left, and native HTML handles the search /
              keyboard / accessibility story without a dependency. */}
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

      {/* Type-specific config */}
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

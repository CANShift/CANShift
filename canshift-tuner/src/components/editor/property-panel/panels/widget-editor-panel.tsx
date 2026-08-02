import { useCallback, useState } from 'react'
import type { HexColor, SignalDef, Widget, WidgetType } from '@tmbk/canshift-core'
import { HexColorSchema } from '@tmbk/canshift-core'

import { useLogStore } from '../../../../stores/log.store'
import { IconTrash } from '../../../icons/Icon'
import { ButtonFields } from '../button-fields'
import { GaugeFields } from '../gauge-fields'
import { ShiftLightFields } from '../shift-light-fields'
import { ConfigFieldsProps, Field, inputStyle } from '../shared'
import { ButtonColorsRow } from './button-colors-row'
import { SizeTokenPicker } from './size-token-picker'
import { MONO_FONT } from '../../../../lib/typography'

const PANEL_LABEL = 'hsl(var(--brand-neutral-600))'
const TYPE_BADGE = '#CC4444'
const DELETE_FG = '#AA3333'

const CONFIG_FIELDS: Partial<
  Record<WidgetType, (props: ConfigFieldsProps) => React.JSX.Element | null>
> = {
  gauge: GaugeFields,
  button: ButtonFields,
  shift_light: ShiftLightFields,
}

const SIGNAL_HIDDEN_TYPES = new Set<WidgetType>(['button', 'timer', 'image'])
const SIZE_HIDDEN_TYPES = new Set<WidgetType>(['gauge'])

interface WidgetEditorPanelProps {
  pageId: string
  widget: Widget
  signals: SignalDef[]
  patch: (p: Partial<Widget>) => void
  onRemove: (pageId: string, widgetId: string) => void
}

export const WidgetEditorPanel = ({
  pageId,
  widget,
  signals,
  patch,
  onRemove,
}: WidgetEditorPanelProps) => {
  const pushLog = useLogStore((s) => s.push)
  const [colorError, setColorError] = useState<string | null>(null)

  const safeParseHex = useCallback(
    (raw: string): HexColor | null => {
      const result = HexColorSchema.safeParse(raw)
      if (result.success) {
        setColorError(null)
        return result.data
      }
      const message = `Invalid color value "${raw}" — expected #RRGGBB hex literal.`
      setColorError(message)
      pushLog('warn', message)
      return null
    },
    [pushLog]
  )

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
            onRemove(pageId, widget.id)
          }}
          title="Delete widget (Del)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: '1px solid hsl(var(--status-danger-dim))',
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
        <div style={{ fontSize: 10, color: PANEL_LABEL, fontFamily: MONO_FONT, padding: '3px 0' }}>
          {widget.id}
        </div>
      </Field>

      {!SIZE_HIDDEN_TYPES.has(widget.type) && <SizeTokenPicker widget={widget} onChange={patch} />}

      {!SIGNAL_HIDDEN_TYPES.has(widget.type) && (
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

      <ButtonColorsRow
        widget={widget}
        colorError={colorError}
        safeParseHex={safeParseHex}
        onChange={patch}
      />

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

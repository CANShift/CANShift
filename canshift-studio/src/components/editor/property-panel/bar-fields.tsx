// property-panel/bar-fields.tsx — Editor for `bar` widgets.

import {
  ALL_UNITS,
  ConfigFieldsProps,
  Field,
  IconPicker,
  PANEL_INPUT_BG,
  PANEL_TEXT_DIM,
  PANEL_TILE_BORDER,
  Row,
  TILE_ACTIVE_BLUE_BG,
  TILE_ACTIVE_BLUE_BORDER,
  TILE_ACTIVE_BLUE_FG,
  TILE_ACTIVE_GREEN_BG,
  TILE_ACTIVE_GREEN_BORDER,
  TILE_ACTIVE_GREEN_FG,
  inputStyle,
} from './shared'

export function BarFields({ widget, onChange }: ConfigFieldsProps) {
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
                background: cfg.suffix === u ? TILE_ACTIVE_GREEN_BG : PANEL_INPUT_BG,
                border: `1px solid ${cfg.suffix === u ? TILE_ACTIVE_GREEN_BORDER : PANEL_TILE_BORDER}`,
                borderRadius: 3,
                color: cfg.suffix === u ? TILE_ACTIVE_GREEN_FG : PANEL_TEXT_DIM,
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
      <Field label="Sensor">
        <IconPicker
          value={cfg.iconName}
          onChange={(name) => {
            onChange({
              config: name ? { ...cfg, iconName: name } : (({ iconName: _, ...r }) => r)(cfg),
            })
          }}
        />
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
                    background: isActive ? TILE_ACTIVE_BLUE_BG : PANEL_INPUT_BG,
                    border: `1px solid ${isActive ? TILE_ACTIVE_BLUE_BORDER : PANEL_TILE_BORDER}`,
                    borderRadius: 3,
                    color: isActive ? TILE_ACTIVE_BLUE_FG : PANEL_TEXT_DIM,
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

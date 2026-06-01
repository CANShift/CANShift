// property-panel/bar-fields.tsx — Editor for `bar` widgets.
//
// Surfaces the `barOrientation` toggle introduced in schema 1.19 (#1232 flag).
// The firmware (bar_widget.cpp) renders a vertical layout via buildVertical()
// when this is set; otherwise it uses the legacy horizontal layout.

import { ConfigFieldsProps, Field, inputStyle } from './shared'

const ORIENTATIONS: { value: 'horizontal' | 'vertical'; label: string }[] = [
  { value: 'horizontal', label: 'Horizontal' },
  { value: 'vertical', label: 'Vertical' },
]

// BarWidgetConfig.labelPosition is constrained to top/bottom centre only —
// the narrow shape is intentional so the firmware band placement is
// unambiguous. Don't reuse the gauge LabelFields helper which assumes the
// full 4-corner enum.
const BAR_LABEL_POSITIONS: { value: 'top-center' | 'bottom-center'; label: string }[] = [
  { value: 'top-center', label: '↑ Top' },
  { value: 'bottom-center', label: '↓ Bottom' },
]

export function BarFields({ widget, onChange }: ConfigFieldsProps) {
  const cfg = widget.config.type === 'bar' ? widget.config : null
  if (!cfg) return null
  const currentOrientation = cfg.barOrientation ?? 'horizontal'
  const currentLabelPos = cfg.labelPosition ?? 'top-center'

  return (
    <>
      <Field label="Orientation">
        <div style={{ display: 'flex', gap: 4 }}>
          {ORIENTATIONS.map(({ value, label }) => {
            const isActive = currentOrientation === value
            return (
              <button
                key={value}
                onClick={() => {
                  // Drop the field when set to the legacy default so existing
                  // configs continue to round-trip without growing it.
                  if (value === 'horizontal') {
                    const { barOrientation: _drop, ...rest } = cfg
                    void _drop
                    onChange({ config: rest })
                  } else {
                    onChange({ config: { ...cfg, barOrientation: value } })
                  }
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
                {label}
              </button>
            )
          })}
        </div>
      </Field>
      <Field label="Label">
        <input
          style={inputStyle}
          placeholder="e.g. RPM, Coolant…"
          value={cfg.label ?? ''}
          onChange={(e) => {
            if (e.target.value) {
              onChange({ config: { ...cfg, label: e.target.value } })
            } else {
              const { label: _drop, ...rest } = cfg
              void _drop
              onChange({ config: rest })
            }
          }}
        />
      </Field>
      {cfg.label && (
        <Field label="Label pos.">
          <div style={{ display: 'flex', gap: 3 }}>
            {BAR_LABEL_POSITIONS.map(({ value, label }) => {
              const isActive = currentLabelPos === value
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

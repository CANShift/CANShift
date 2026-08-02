import { SHIFT_LIGHT_SEGMENT_COUNT } from '@tmbk/canshift-core'
import { ConfigFieldsProps, Field, Row, numberInputStyle } from './shared'

export const ShiftLightFields = ({ widget, onChange }: ConfigFieldsProps) => {
  if (widget.config.type !== 'shift_light') return null
  const cfg = widget.config

  return (
    <Row>
      <Field label="First segment at">
        <input
          type="number"
          style={numberInputStyle}
          value={cfg.startValue}
          min={0}
          onChange={(e) => {
            const startValue = Math.max(0, Number(e.target.value))
            onChange({ config: { ...cfg, startValue } })
          }}
        />
      </Field>
      <Field label="Red segments">
        <input
          type="number"
          style={numberInputStyle}
          value={cfg.redSegments}
          min={0}
          max={SHIFT_LIGHT_SEGMENT_COUNT}
          onChange={(e) => {
            const raw = Math.round(Number(e.target.value))
            const redSegments = Math.min(SHIFT_LIGHT_SEGMENT_COUNT, Math.max(0, raw))
            onChange({ config: { ...cfg, redSegments } })
          }}
        />
      </Field>
    </Row>
  )
}

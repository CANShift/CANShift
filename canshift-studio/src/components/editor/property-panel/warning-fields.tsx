// property-panel/warning-fields.tsx — Editor for `warning` widgets.

import { Checkbox } from '@/components/ui/checkbox'
import { ConfigFieldsProps, Field, IconPicker, LabelFields, numberInputStyle } from './shared'

export function WarningFields({ widget, onChange }: ConfigFieldsProps) {
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
        <Checkbox
          checked={cfg.invertLogic ?? false}
          onCheckedChange={(checked) => {
            onChange({ config: { ...cfg, invertLogic: checked === true } })
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

// property-panel/gear-fields.tsx — Editor for `gear` widgets.

import { Checkbox } from '@/components/ui/checkbox'
import { ConfigFieldsProps, Field, LabelFields } from './shared'

export function GearFields({ widget, onChange }: ConfigFieldsProps) {
  const cfg = widget.config.type === 'gear' ? widget.config : null
  if (!cfg) return null
  return (
    <>
      <Field label="Hide if invalid">
        <Checkbox
          checked={cfg.hideWhenInvalid ?? false}
          onCheckedChange={(checked) => {
            onChange({ config: { ...cfg, hideWhenInvalid: checked === true } })
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

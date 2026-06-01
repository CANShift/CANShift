// property-panel/gear-fields.tsx — Editor for `gear` widgets.

import { ConfigFieldsProps, LabelFields } from './shared'

export function GearFields({ widget, onChange }: ConfigFieldsProps) {
  const cfg = widget.config.type === 'gear' ? widget.config : null
  if (!cfg) return null
  return (
    <LabelFields
      cfg={cfg}
      onChange={(next) => {
        onChange({ config: next })
      }}
    />
  )
}

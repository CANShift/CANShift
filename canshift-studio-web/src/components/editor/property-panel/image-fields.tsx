// property-panel/image-fields.tsx — Editor for `image` widgets.

import { ConfigFieldsProps, Field, LabelFields, inputStyle } from './shared'

export function ImageFields({ widget, onChange }: ConfigFieldsProps) {
  const cfg = widget.config.type === 'image' ? widget.config : null
  if (!cfg) return null
  return (
    <>
      <Field label="Path">
        <input
          style={inputStyle}
          placeholder="/images/logo.bin"
          value={cfg.imagePath}
          onChange={(e) => {
            onChange({ config: { ...cfg, imagePath: e.target.value } })
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

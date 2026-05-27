// property-panel/bar-fields.tsx — Editor for `bar` widgets.
//
// Stripped to the essentials: the bar widget reads its unit from the bound
// signal definition and renders the signal name as an auto-label (no custom
// label / prefix / decimals / unit-override fields here). Sensor icon stays
// because the bar widget's danger flash still resolves through the legacy
// sensor palette; the signal-type palette migration will pick this up.

import { ConfigFieldsProps, Field, IconPicker } from './shared'

export function BarFields({ widget, onChange }: ConfigFieldsProps) {
  const cfg = widget.config.type === 'bar' ? widget.config : null
  if (!cfg) return null
  return (
    <>
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
    </>
  )
}

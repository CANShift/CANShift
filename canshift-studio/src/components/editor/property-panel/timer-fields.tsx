// property-panel/timer-fields.tsx — Editor for `timer` widgets.

import { Checkbox } from '@/components/ui/checkbox'
import { ConfigFieldsProps, Field, LabelFields } from './shared'

export function TimerFields({ widget, onChange }: ConfigFieldsProps) {
  const cfg = widget.config.type === 'timer' ? widget.config : null
  if (!cfg) return null
  return (
    <>
      <Field label="Format">
        <div style={{ display: 'flex', gap: 3 }}>
          {(['mm:ss', 'ss.mmm'] as const).map((fmt) => {
            const isActive = (cfg.format ?? 'mm:ss') === fmt
            return (
              <button
                key={fmt}
                onClick={() => {
                  onChange({ config: { ...cfg, format: fmt } })
                }}
                style={{
                  flex: 1,
                  padding: '3px 0',
                  fontSize: 10,
                  background: isActive ? '#2A2A3A' : '#111111',
                  border: `1px solid ${isActive ? '#5566AA' : '#2A2A2A'}`,
                  borderRadius: 3,
                  color: isActive ? '#7788CC' : '#AAAAAA',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                {fmt}
              </button>
            )
          })}
        </div>
      </Field>
      <Field label="Auto-start">
        <Checkbox
          checked={cfg.autoStart ?? false}
          onCheckedChange={(checked) => {
            onChange({ config: { ...cfg, autoStart: checked === true } })
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

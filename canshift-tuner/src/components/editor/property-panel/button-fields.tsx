import { useState } from 'react'
import type { ButtonWidgetConfig } from '@tmbk/canshift-core'

import { Checkbox } from '@/components/ui/checkbox'
import { useDashboardStore } from '../../../stores/dashboard.store'
import { WidgetPreview } from '../WidgetPreview'
import { CycleModeBody } from './button/cycle-mode-body'
import { ModeToggle } from './button/mode-toggle'
import { convertCycleToSingle, convertSingleToCycle, EMPTY_PAGES } from './button/shared'
import { SingleModeBody } from './button/single-mode-body'
import { Field, IconPicker, inputStyle, type ConfigFieldsProps } from './shared'

export const ButtonFields = ({ widget, onChange }: ConfigFieldsProps) => {
  const pages = useDashboardStore((s) => s.config?.pages ?? EMPTY_PAGES)
  const pageIds = pages.map((p) => p.id)
  const [previewActive, setPreviewActive] = useState(false)
  const [previewStateIdx, setPreviewStateIdx] = useState(0)

  if (widget.config.type !== 'button') return null
  const cfg: ButtonWidgetConfig = widget.config

  const { w, h } = widget.layout
  const PREVIEW_BUDGET_W = 140
  const PREVIEW_BUDGET_H = 180
  const PREVIEW_MAX_SCALE = 4
  const previewScale = Math.min(PREVIEW_MAX_SCALE, PREVIEW_BUDGET_W / w, PREVIEW_BUDGET_H / h)
  const previewW = Math.round(w * previewScale)
  const previewH = Math.round(h * previewScale)

  const cycleStateCount = cfg.mode === 'cycle' ? cfg.states.length : 0
  const clampedPreviewIdx = cycleStateCount > 0 ? previewStateIdx % cycleStateCount : 0

  const handleModeChange = (next: 'single' | 'cycle') => {
    if (cfg.mode === next) return
    if (cfg.mode === 'single' && next === 'cycle') {
      onChange({ config: convertSingleToCycle(cfg, pageIds) })
    } else if (cfg.mode === 'cycle' && next === 'single') {
      onChange({ config: convertCycleToSingle(cfg, pageIds) })
    }
    setPreviewStateIdx(0)
  }

  return (
    <>
      <Field label="Active state">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <div
            style={{
              border: `1px solid ${previewActive ? widget.style.primaryColor : '#2A2A2A'}`,
              borderRadius: 3,
              overflow: 'hidden',
              display: 'inline-block',
              flexShrink: 0,
            }}
          >
            <WidgetPreview
              widget={widget}
              displayW={previewW}
              displayH={previewH}
              buttonActive={previewActive}
              cycleStateIndex={cfg.mode === 'cycle' ? clampedPreviewIdx : undefined}
            />
          </div>
          {cfg.mode === 'single' ? (
            <button
              onClick={() => {
                setPreviewActive((v) => !v)
              }}
              style={{
                fontSize: 10,
                padding: '3px 8px',
                background: previewActive ? '#2A1A1A' : 'transparent',
                border: `1px solid ${previewActive ? '#AA3333' : '#2A2A2A'}`,
                borderRadius: 3,
                color: previewActive ? '#FF4444' : '#AAAAAA',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {previewActive ? 'Active' : 'Idle'}
            </button>
          ) : (
            <button
              onClick={() => {
                setPreviewStateIdx((i) => (i + 1) % Math.max(1, cycleStateCount))
              }}
              style={{
                fontSize: 10,
                padding: '3px 8px',
                background: 'transparent',
                border: '1px solid #2A2A2A',
                borderRadius: 3,
                color: '#AAAAAA',
                cursor: 'pointer',
                flexShrink: 0,
                fontFamily: 'monospace',
              }}
              title="Click to preview next cycle state"
            >
              {clampedPreviewIdx + 1} / {Math.max(1, cycleStateCount)} ›
            </button>
          )}
        </div>
      </Field>

      <Field label="Mode">
        <ModeToggle mode={cfg.mode} onChange={handleModeChange} />
      </Field>

      <Field label="Label">
        <input
          style={inputStyle}
          value={cfg.label}
          onChange={(e) => {
            onChange({ config: { ...cfg, label: e.target.value } })
          }}
        />
      </Field>

      <Field label="Show">
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#AAAAAA' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
            <Checkbox
              checked={cfg.showLabel !== false}
              onCheckedChange={(checked) => {
                onChange({ config: { ...cfg, showLabel: checked === true } })
              }}
            />
            Text
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
            <Checkbox
              checked={cfg.showIcon === true}
              onCheckedChange={(checked) => {
                onChange({ config: { ...cfg, showIcon: checked === true } })
              }}
            />
            Icon
          </label>
        </div>
      </Field>

      {(cfg.showIcon ?? false) && (
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
      )}

      {cfg.mode === 'single' ? (
        <SingleModeBody cfg={cfg} pageIds={pageIds} onChange={onChange} />
      ) : (
        <CycleModeBody cfg={cfg} pageIds={pageIds} onChange={onChange} />
      )}
    </>
  )
}

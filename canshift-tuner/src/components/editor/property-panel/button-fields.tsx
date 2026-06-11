import { useState } from 'react'
import {
  CRUISE_CONTROL_OPS,
  type ButtonAction,
  type CruiseControlOp,
  type PageConfig,
} from '@tmbk/canshift-core'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { IconTrash } from '../../icons/Icon'
import { WidgetPreview } from '../WidgetPreview'
import { useDashboardStore } from '../../../stores/dashboard.store'
import { actionKey, newId } from '../../../utils/listKeys'
import { ConfigFieldsProps, Field, IconPicker, inputStyle, numberInputStyle } from './shared'

const CRUISE_STEP_OPS = new Set<CruiseControlOp>(['increment', 'decrement'])

const EMPTY_PAGES: readonly PageConfig[] = []

interface ActionRowProps {
  action: ButtonAction
  pageIds: string[]
  onUpdate: (updated: ButtonAction) => void
  onRemove: () => void
}

const ActionRow = ({ action, pageIds, onUpdate, onRemove }: ActionRowProps) => {
  const typeLabel =
    action.type === 'navigate'
      ? 'Navigate'
      : action.type === 'map_switch'
        ? 'Map Switch'
        : action.type === 'can_raw'
          ? 'CAN Raw'
          : 'Cruise Ctrl'

  const categoryColor = action.category === 'ecu' ? '#CC8800' : '#5577CC'

  return (
    <div
      style={{
        background: '#111111',
        border: '1px solid #2A2A2A',
        borderRadius: 3,
        padding: '6px 8px',
        marginBottom: 5,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 5,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: categoryColor,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {action.category} — {typeLabel}
        </span>
        <button
          onClick={onRemove}
          style={{
            background: 'none',
            border: 'none',
            color: '#553333',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
          }}
          title="Remove action"
        >
          <IconTrash size={11} color="#553333" />
        </button>
      </div>

      {action.category === 'dashboard' && (
        <select
          style={{ ...inputStyle, fontSize: 11 }}
          value={action.pageId}
          onChange={(e) => {
            onUpdate({ ...action, pageId: e.target.value })
          }}
        >
          <option value="">— select page —</option>
          {pageIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      )}

      {action.category === 'ecu' && action.type === 'map_switch' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: '#666666' }}>Map</span>
          <input
            type="number"
            min={1}
            max={8}
            style={{ ...numberInputStyle, width: 50 }}
            value={action.mapIndex}
            onChange={(e) => {
              onUpdate({ ...action, mapIndex: Number(e.target.value) })
            }}
          />
        </div>
      )}

      {action.category === 'ecu' && action.type === 'can_raw' && (
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ flex: '0 0 70px' }}>
            <div style={{ fontSize: 9, color: '#AAAAAA', marginBottom: 2 }}>FRAME ID</div>
            <input
              style={{ ...inputStyle, fontSize: 10 }}
              placeholder="0x123"
              value={`0x${action.frameId.toString(16).toUpperCase()}`}
              onChange={(e) => {
                const v = parseInt(e.target.value, 16)
                if (!isNaN(v)) onUpdate({ ...action, frameId: v })
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: '#AAAAAA', marginBottom: 2 }}>DATA (HEX)</div>
            <input
              style={{ ...inputStyle, fontSize: 10, fontFamily: 'monospace' }}
              placeholder="0102030405060708"
              value={action.data}
              onChange={(e) => {
                onUpdate({ ...action, data: e.target.value })
              }}
            />
          </div>
        </div>
      )}

      {action.category === 'ecu' && action.type === 'cruise_control' && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: '#AAAAAA', marginBottom: 2 }}>OP</div>
            <select
              style={{ ...inputStyle, fontSize: 11 }}
              value={action.op}
              onChange={(e) => {
                const nextOp = e.target.value as CruiseControlOp
                if (!CRUISE_STEP_OPS.has(nextOp) && action.stepKmh !== undefined) {
                  const { stepKmh: _drop, ...rest } = action
                  void _drop
                  onUpdate({ ...rest, op: nextOp })
                  return
                }
                onUpdate({ ...action, op: nextOp })
              }}
            >
              {CRUISE_CONTROL_OPS.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </div>
          {CRUISE_STEP_OPS.has(action.op) && (
            <div style={{ flex: '0 0 80px' }}>
              <div style={{ fontSize: 9, color: '#AAAAAA', marginBottom: 2 }}>STEP (KM/H)</div>
              <input
                type="number"
                min={1}
                max={20}
                style={{ ...numberInputStyle, fontSize: 11 }}
                value={action.stepKmh ?? 1}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (Number.isFinite(v)) onUpdate({ ...action, stepKmh: v })
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const AddActionMenu = ({
  pageIds,
  onAdd,
}: {
  pageIds: string[]
  onAdd: (a: ButtonAction) => void
}) => {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
      {[
        {
          label: 'Navigate',
          action: (): ButtonAction => ({
            category: 'dashboard',
            type: 'navigate',
            pageId: pageIds[0] ?? '',
          }),
          color: '#5577CC',
        },
        {
          label: 'Map Switch',
          action: (): ButtonAction => ({ category: 'ecu', type: 'map_switch', mapIndex: 1 }),
          color: '#CC8800',
        },
        {
          label: 'CAN Raw',
          action: (): ButtonAction => ({ category: 'ecu', type: 'can_raw', frameId: 0, data: '' }),
          color: '#CC8800',
        },
        {
          label: 'Cruise Ctrl',
          action: (): ButtonAction => ({
            category: 'ecu',
            type: 'cruise_control',
            op: 'toggle',
          }),
          color: '#CC8800',
        },
      ].map(({ label, action, color }) => (
        <button
          key={label}
          onClick={() => {
            onAdd(action())
          }}
          style={{
            fontSize: 10,
            padding: '2px 7px',
            background: 'transparent',
            border: `1px solid ${color}44`,
            borderRadius: 3,
            color: color,
            cursor: 'pointer',
          }}
        >
          + {label}
        </button>
      ))}
    </div>
  )
}

export const ButtonFields = ({ widget, onChange }: ConfigFieldsProps) => {
  const cfg =
    widget.config.type === 'button' && widget.config.mode === 'single' ? widget.config : null
  const pages = useDashboardStore((s) => s.config?.pages ?? EMPTY_PAGES)
  const pageIds = pages.map((p) => p.id)
  const [previewActive, setPreviewActive] = useState(false)

  if (!cfg) return null

  const updateAction = (idx: number, updated: ButtonAction) => {
    const next = cfg.actions.map((a, i) => (i === idx ? updated : a))
    onChange({ config: { ...cfg, actions: next } })
  }

  const removeAction = (idx: number) => {
    onChange({ config: { ...cfg, actions: cfg.actions.filter((_, i) => i !== idx) } })
  }

  const addAction = (action: ButtonAction) => {
    const withId: ButtonAction = action.id !== undefined ? action : { ...action, id: newId() }
    onChange({ config: { ...cfg, actions: [...cfg.actions, withId] } })
  }

  const { w, h } = widget.layout
  const PREVIEW_BUDGET_W = 140
  const PREVIEW_BUDGET_H = 180
  const PREVIEW_MAX_SCALE = 4
  const previewScale = Math.min(PREVIEW_MAX_SCALE, PREVIEW_BUDGET_W / w, PREVIEW_BUDGET_H / h)
  const previewW = Math.round(w * previewScale)
  const previewH = Math.round(h * previewScale)

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
            />
          </div>
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
        </div>
      </Field>

      <Field label="Mode">
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: '#AAAAAA',
            cursor: 'pointer',
          }}
        >
          <Switch
            checked={cfg.isToggle === true}
            onCheckedChange={(checked) => {
              onChange({ config: { ...cfg, isToggle: checked } })
            }}
          />
          Toggle (stays active after press)
        </label>
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

      <div
        style={{
          fontSize: 10,
          color: '#AAAAAA',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 5,
          marginTop: 4,
        }}
      >
        Actions
      </div>

      {cfg.actions.length === 0 && (
        <div style={{ fontSize: 11, color: '#AAAAAA', marginBottom: 6 }}>No actions yet.</div>
      )}

      {cfg.actions.map((action, idx) => (
        <ActionRow
          key={actionKey(action)}
          action={action}
          pageIds={pageIds}
          onUpdate={(updated) => {
            updateAction(idx, updated)
          }}
          onRemove={() => {
            removeAction(idx)
          }}
        />
      ))}

      <AddActionMenu pageIds={pageIds} onAdd={addAction} />
    </>
  )
}

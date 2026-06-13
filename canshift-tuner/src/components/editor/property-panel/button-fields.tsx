import { useState } from 'react'
import {
  CRUISE_CONTROL_OPS,
  MAX_CYCLE_STATES,
  MIN_CYCLE_STATES,
  type ButtonAction,
  type ButtonWidgetConfig,
  type CruiseControlOp,
  type PageConfig,
  type SingleActionButtonConfig,
} from '@tmbk/canshift-core'

type CycleConfig = Exclude<ButtonWidgetConfig, SingleActionButtonConfig>
type CycleState = CycleConfig['states'][number]
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { IconTrash } from '../../icons/Icon'
import { WidgetPreview } from '../WidgetPreview'
import { useDashboardStore } from '../../../stores/dashboard.store'
import { actionKey, newId } from '../../../utils/list-keys'
import { ConfigFieldsProps, Field, IconPicker, inputStyle, numberInputStyle } from './shared'

const CRUISE_STEP_OPS = new Set<CruiseControlOp>(['increment', 'decrement'])

const HEX_FRAME_ID_REGEX = /^(0[xX])?[0-9a-fA-F]{1,8}$/

const EMPTY_PAGES: readonly PageConfig[] = []

const defaultNavigateAction = (pageIds: string[]): ButtonAction => ({
  category: 'dashboard',
  type: 'navigate',
  pageId: pageIds[0] ?? '',
})

interface ActionEditorProps {
  action: ButtonAction
  pageIds: string[]
  onUpdate: (updated: ButtonAction) => void
}

const ActionEditor = ({ action, pageIds, onUpdate }: ActionEditorProps) => (
  <>
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
              const raw = e.target.value.trim()
              if (!HEX_FRAME_ID_REGEX.test(raw)) return
              onUpdate({ ...action, frameId: parseInt(raw, 16) })
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
  </>
)

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
      <ActionEditor action={action} pageIds={pageIds} onUpdate={onUpdate} />
    </div>
  )
}

const ACTION_PRESETS = (
  pageIds: string[]
): { label: string; color: string; build: () => ButtonAction }[] => [
  {
    label: 'Navigate',
    color: '#5577CC',
    build: () => defaultNavigateAction(pageIds),
  },
  {
    label: 'Map Switch',
    color: '#CC8800',
    build: () => ({ category: 'ecu', type: 'map_switch', mapIndex: 1 }),
  },
  {
    label: 'CAN Raw',
    color: '#CC8800',
    build: () => ({ category: 'ecu', type: 'can_raw', frameId: 0, data: '' }),
  },
  {
    label: 'Cruise Ctrl',
    color: '#CC8800',
    build: () => ({ category: 'ecu', type: 'cruise_control', op: 'toggle' }),
  },
]

const AddActionMenu = ({
  pageIds,
  onAdd,
}: {
  pageIds: string[]
  onAdd: (a: ButtonAction) => void
}) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
    {ACTION_PRESETS(pageIds).map(({ label, color, build }) => (
      <button
        key={label}
        onClick={() => {
          onAdd(build())
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

interface ActionTypeMenuProps {
  pageIds: string[]
  onSelect: (a: ButtonAction) => void
}

const ActionTypeMenu = ({ pageIds, onSelect }: ActionTypeMenuProps) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
    {ACTION_PRESETS(pageIds).map(({ label, color, build }) => (
      <button
        key={label}
        onClick={() => {
          onSelect(build())
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
        {label}
      </button>
    ))}
  </div>
)

interface CycleStateRowProps {
  state: CycleState
  index: number
  isInitial: boolean
  canRemove: boolean
  pageIds: string[]
  onUpdate: (updated: CycleState) => void
  onRemove: () => void
  onSetInitial: () => void
}

const CycleStateRow = ({
  state,
  index,
  isInitial,
  canRemove,
  pageIds,
  onUpdate,
  onRemove,
  onSetInitial,
}: CycleStateRowProps) => {
  const typeLabel =
    state.action.type === 'navigate'
      ? 'Navigate'
      : state.action.type === 'map_switch'
        ? 'Map Switch'
        : state.action.type === 'can_raw'
          ? 'CAN Raw'
          : 'Cruise Ctrl'
  const categoryColor = state.action.category === 'ecu' ? '#CC8800' : '#5577CC'

  return (
    <div
      style={{
        background: isInitial ? '#1A1A22' : '#111111',
        border: `1px solid ${isInitial ? '#3A3A66' : '#2A2A2A'}`,
        borderRadius: 3,
        padding: '6px 8px',
        marginBottom: 5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <span style={{ fontSize: 10, color: '#666666', minWidth: 16 }}>{index + 1}</span>
        <input
          style={{ ...inputStyle, fontSize: 11, flex: 1 }}
          value={state.label}
          placeholder={`State ${String(index + 1)}`}
          onChange={(e) => {
            onUpdate({ ...state, label: e.target.value })
          }}
        />
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10,
            color: isInitial ? '#7788CC' : '#666666',
            cursor: 'pointer',
          }}
          title="Active on load"
        >
          <input
            type="radio"
            checked={isInitial}
            onChange={onSetInitial}
            style={{ accentColor: '#7788CC', cursor: 'pointer' }}
          />
          Initial
        </label>
        <button
          onClick={onRemove}
          disabled={!canRemove}
          style={{
            background: 'none',
            border: 'none',
            color: canRemove ? '#553333' : '#2A2A2A',
            cursor: canRemove ? 'pointer' : 'not-allowed',
            padding: 0,
            display: 'flex',
          }}
          title={canRemove ? 'Remove state' : `Need at least ${String(MIN_CYCLE_STATES)} states`}
        >
          <IconTrash size={11} color={canRemove ? '#553333' : '#2A2A2A'} />
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: categoryColor,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {state.action.category} — {typeLabel}
        </span>
        <ActionTypeMenu
          pageIds={pageIds}
          onSelect={(action) => {
            onUpdate({ ...state, action })
          }}
        />
      </div>
      <ActionEditor
        action={state.action}
        pageIds={pageIds}
        onUpdate={(action) => {
          onUpdate({ ...state, action })
        }}
      />
    </div>
  )
}

type SharedConfigFields = Pick<
  ButtonWidgetConfig,
  'label' | 'iconName' | 'iconPath' | 'showIcon' | 'showLabel' | 'colors'
>

const extractSharedFields = (cfg: ButtonWidgetConfig): SharedConfigFields => ({
  label: cfg.label,
  ...(cfg.iconName !== undefined ? { iconName: cfg.iconName } : {}),
  ...(cfg.iconPath !== undefined ? { iconPath: cfg.iconPath } : {}),
  ...(cfg.showIcon !== undefined ? { showIcon: cfg.showIcon } : {}),
  ...(cfg.showLabel !== undefined ? { showLabel: cfg.showLabel } : {}),
  ...(cfg.colors !== undefined ? { colors: cfg.colors } : {}),
})

const convertSingleToCycle = (
  cfg: SingleActionButtonConfig,
  pageIds: string[]
): ButtonWidgetConfig => {
  const fallback = defaultNavigateAction(pageIds)
  const states: CycleState[] = []
  const seed = cfg.actions.slice(0, MAX_CYCLE_STATES)
  for (let i = 0; i < Math.max(MIN_CYCLE_STATES, seed.length); i++) {
    const action = seed[i] ?? fallback
    states.push({ label: `State ${String(i + 1)}`, action })
  }
  return {
    type: 'button',
    mode: 'cycle',
    ...extractSharedFields(cfg),
    states,
    initialActiveIndex: 0,
  }
}

const convertCycleToSingle = (cfg: CycleConfig, pageIds: string[]): ButtonWidgetConfig => {
  const activeState = cfg.states[cfg.initialActiveIndex] ?? cfg.states[0]
  const action = activeState?.action ?? defaultNavigateAction(pageIds)
  return {
    type: 'button',
    mode: 'single',
    ...extractSharedFields(cfg),
    actions: [action],
  }
}

const modePillStyle = (active: boolean): React.CSSProperties => ({
  flex: 1,
  fontSize: 11,
  padding: '5px 8px',
  background: active ? '#1A2A4A' : 'transparent',
  border: `1px solid ${active ? '#5577CC' : '#2A2A2A'}`,
  borderRadius: 3,
  color: active ? '#7788CC' : '#666666',
  cursor: 'pointer',
  fontWeight: active ? 600 : 400,
})

interface ModeToggleProps {
  mode: 'single' | 'cycle'
  onChange: (next: 'single' | 'cycle') => void
}

const ModeToggle = ({ mode, onChange }: ModeToggleProps) => (
  <div style={{ display: 'flex', gap: 4 }}>
    <button
      style={modePillStyle(mode === 'single')}
      onClick={() => {
        onChange('single')
      }}
    >
      Single action
    </button>
    <button
      style={modePillStyle(mode === 'cycle')}
      onClick={() => {
        onChange('cycle')
      }}
    >
      Cycle (2–{MAX_CYCLE_STATES} states)
    </button>
  </div>
)

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

interface SingleModeBodyProps {
  cfg: SingleActionButtonConfig
  pageIds: string[]
  onChange: ConfigFieldsProps['onChange']
}

const SingleModeBody = ({ cfg, pageIds, onChange }: SingleModeBodyProps) => {
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

  return (
    <>
      <Field label="Behaviour">
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

interface CycleModeBodyProps {
  cfg: CycleConfig
  pageIds: string[]
  onChange: ConfigFieldsProps['onChange']
}

const CycleModeBody = ({ cfg, pageIds, onChange }: CycleModeBodyProps) => {
  const updateState = (idx: number, updated: CycleState) => {
    const next = cfg.states.map((s, i) => (i === idx ? updated : s))
    onChange({ config: { ...cfg, states: next } })
  }

  const removeState = (idx: number) => {
    if (cfg.states.length <= MIN_CYCLE_STATES) return
    const next = cfg.states.filter((_, i) => i !== idx)
    const nextInitial =
      cfg.initialActiveIndex >= next.length ? next.length - 1 : cfg.initialActiveIndex
    onChange({ config: { ...cfg, states: next, initialActiveIndex: nextInitial } })
  }

  const addState = () => {
    if (cfg.states.length >= MAX_CYCLE_STATES) return
    const next: CycleState = {
      label: `State ${String(cfg.states.length + 1)}`,
      action: defaultNavigateAction(pageIds),
    }
    onChange({ config: { ...cfg, states: [...cfg.states, next] } })
  }

  const setInitial = (idx: number) => {
    onChange({ config: { ...cfg, initialActiveIndex: idx } })
  }

  const canAdd = cfg.states.length < MAX_CYCLE_STATES
  const canRemove = cfg.states.length > MIN_CYCLE_STATES

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          marginTop: 4,
          marginBottom: 5,
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: '#AAAAAA',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Cycle states
        </div>
        <div style={{ fontSize: 10, color: '#666666' }}>
          {cfg.states.length} / {MAX_CYCLE_STATES}
        </div>
      </div>

      {cfg.states.map((state, idx) => (
        <CycleStateRow
          key={idx}
          state={state}
          index={idx}
          isInitial={idx === cfg.initialActiveIndex}
          canRemove={canRemove}
          pageIds={pageIds}
          onUpdate={(updated) => {
            updateState(idx, updated)
          }}
          onRemove={() => {
            removeState(idx)
          }}
          onSetInitial={() => {
            setInitial(idx)
          }}
        />
      ))}

      <button
        onClick={addState}
        disabled={!canAdd}
        style={{
          fontSize: 11,
          padding: '4px 10px',
          background: 'transparent',
          border: `1px solid ${canAdd ? '#7788CC44' : '#2A2A2A'}`,
          borderRadius: 3,
          color: canAdd ? '#7788CC' : '#444444',
          cursor: canAdd ? 'pointer' : 'not-allowed',
          marginTop: 2,
        }}
      >
        + Add state
      </button>
    </>
  )
}

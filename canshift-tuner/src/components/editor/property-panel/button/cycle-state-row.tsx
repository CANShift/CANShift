import { MIN_CYCLE_STATES } from '@tmbk/canshift-core'

import { IconTrash } from '../../../icons/Icon'
import { inputStyle } from '../shared'
import { ActionEditor } from './action-editor'
import { ActionTypeMenu } from './action-type-menu'
import type { CycleState } from './shared'

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

export const CycleStateRow = ({
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

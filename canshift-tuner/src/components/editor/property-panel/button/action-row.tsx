import type { ButtonAction } from '@tmbk/canshift-core'

import { IconTrash } from '../../../icons/Icon'
import { ActionEditor } from './action-editor'

interface ActionRowProps {
  action: ButtonAction
  pageIds: string[]
  onUpdate: (updated: ButtonAction) => void
  onRemove: () => void
}

export const ActionRow = ({ action, pageIds, onUpdate, onRemove }: ActionRowProps) => {
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
        background: 'hsl(var(--brand-neutral-100))',
        border: '1px solid hsl(var(--brand-neutral-300))',
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

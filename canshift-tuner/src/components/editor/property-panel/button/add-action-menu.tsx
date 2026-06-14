import type { ButtonAction } from '@tmbk/canshift-core'

import { buildActionPresets } from './shared'

interface AddActionMenuProps {
  pageIds: string[]
  onAdd: (a: ButtonAction) => void
}

export const AddActionMenu = ({ pageIds, onAdd }: AddActionMenuProps) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
    {buildActionPresets(pageIds).map(({ label, color, build }) => (
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

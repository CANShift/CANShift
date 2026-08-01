import type { ButtonAction } from '@tmbk/canshift-core'

import { buildActionPresets } from './shared'

interface ActionTypeMenuProps {
  pageIds: string[]
  onSelect: (a: ButtonAction) => void
}

export const ActionTypeMenu = ({ pageIds, onSelect }: ActionTypeMenuProps) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
    {buildActionPresets(pageIds).map(({ label, color, build }) => (
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
          color: color,
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
    ))}
  </div>
)

import { MAX_CYCLE_STATES } from '@tmbk/canshift-core'

import { modePillStyle } from './shared'

interface ModeToggleProps {
  mode: 'single' | 'cycle'
  onChange: (next: 'single' | 'cycle') => void
}

export const ModeToggle = ({ mode, onChange }: ModeToggleProps) => (
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

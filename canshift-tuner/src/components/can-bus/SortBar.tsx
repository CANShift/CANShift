import type { CSSProperties } from 'react'
import { TogglePill } from '../ui/toggle-pill'

export type SortKey = 'id' | 'lastSeen' | 'rate' | 'count'

interface SortBarProps {
  sortKey: SortKey
  onChange: (key: SortKey) => void
}

const SORT_OPTIONS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: 'id', label: 'ID' },
  { key: 'lastSeen', label: 'Last seen' },
  { key: 'rate', label: 'Rate' },
  { key: 'count', label: 'Count' },
]

const sortBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 20px',
  borderBottom: '1px solid hsl(var(--border))',
  background: 'hsl(var(--surface))',
}

const sortLabelStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'hsl(var(--text-muted))',
  marginRight: 4,
}

export const SortBar = ({ sortKey, onChange }: SortBarProps) => (
  <div style={sortBarStyle}>
    <span style={sortLabelStyle}>Sort by</span>
    {SORT_OPTIONS.map((o) => (
      <TogglePill
        key={o.key}
        active={o.key === sortKey}
        onClick={() => {
          onChange(o.key)
        }}
      >
        {o.label}
      </TogglePill>
    ))}
  </div>
)

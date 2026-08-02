import type { CSSProperties } from 'react'

export type SortKey = 'id' | 'lastSeen' | 'rate' | 'count' | 'activity'

interface SortBarProps {
  sortKey: SortKey
  onChange: (key: SortKey) => void
}

const SORT_OPTIONS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: 'id', label: 'ID' },
  { key: 'lastSeen', label: 'LAST SEEN' },
  { key: 'rate', label: 'RATE' },
  { key: 'count', label: 'COUNT' },
  { key: 'activity', label: 'ACTIVITY' },
]

export const SortBar = ({ sortKey, onChange }: SortBarProps) => (
  <div style={groupStyle} role="group" aria-label="Sort frames by">
    {SORT_OPTIONS.map((o) => (
      <button
        key={o.key}
        type="button"
        aria-pressed={o.key === sortKey}
        onClick={() => {
          onChange(o.key)
        }}
        style={segmentStyle(o.key === sortKey)}
      >
        {o.label}
      </button>
    ))}
  </div>
)

const groupStyle: CSSProperties = {
  display: 'flex',
  border: '1px solid hsl(var(--brand-neutral-400))',
}

const segmentStyle = (active: boolean): CSSProperties => ({
  padding: '5px 12px',
  background: active ? 'hsl(var(--brand-text))' : 'none',
  border: 'none',
  fontWeight: 800,
  fontSize: 11,
  letterSpacing: '0.08em',
  color: active ? 'hsl(var(--brand-chrome-bg))' : 'hsl(var(--brand-neutral-700))',
  cursor: 'pointer',
})

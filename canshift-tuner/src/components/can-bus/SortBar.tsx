import type { CSSProperties } from 'react'

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

const sortPillStyle = (active: boolean): CSSProperties => ({
  background: active ? 'hsl(var(--primary) / 0.15)' : 'transparent',
  color: active ? 'hsl(var(--primary))' : 'hsl(var(--text-dim))',
  border: `1px solid ${active ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
  borderRadius: 999,
  padding: '3px 12px',
  fontSize: 11,
  cursor: 'pointer',
  fontWeight: 600,
  letterSpacing: '0.04em',
})

export const SortBar = ({ sortKey, onChange }: SortBarProps) => (
  <div style={sortBarStyle}>
    <span style={sortLabelStyle}>Sort by</span>
    {SORT_OPTIONS.map((o) => {
      const active = o.key === sortKey
      return (
        <button
          key={o.key}
          type="button"
          onClick={() => {
            onChange(o.key)
          }}
          style={sortPillStyle(active)}
        >
          {o.label}
        </button>
      )
    })}
  </div>
)

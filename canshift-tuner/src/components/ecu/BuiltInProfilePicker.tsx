import type { CSSProperties } from 'react'
import type { EcuProfile } from '@tmbk/canshift-core'

export interface BuiltInProfilePickerProps {
  profiles: readonly EcuProfile[]
  selectedKey: string
  activeProfileKey: string
  onSelect: (profileId: string) => void
}

export function BuiltInProfilePicker({
  profiles,
  selectedKey,
  activeProfileKey,
  onSelect,
}: BuiltInProfilePickerProps) {
  return (
    <div style={listStyle} role="listbox" aria-label="Built-in ECU profiles">
      {profiles.map((profile) => {
        const key = `builtin:${profile.id}`
        const isSelected = selectedKey === key
        const isActive = activeProfileKey === key
        return (
          <button
            key={profile.id}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => {
              onSelect(profile.id)
            }}
            style={itemStyle(isSelected)}
          >
            <div style={titleRowStyle}>
              <span style={nameStyle}>{profile.name}</span>
              {isActive && <span style={activeTagStyle}>active</span>}
            </div>
            <div style={descStyle}>{profile.description}</div>
            <div style={metaStyle}>
              {profile.signals.length} signal{profile.signals.length === 1 ? '' : 's'} ·{' '}
              {profile.protocol}
            </div>
          </button>
        )
      })}
    </div>
  )
}

const listStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: 4,
  overflowY: 'auto',
  flex: 1,
  minHeight: 0,
}

const itemStyle = (selected: boolean): CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '12px 14px',
  background: selected ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--surface))',
  border: `1px solid ${selected ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
  borderRadius: 6,
  textAlign: 'left',
  cursor: 'pointer',
  color: 'hsl(var(--text))',
  fontFamily: 'inherit',
})

const titleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const nameStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
}

const activeTagStyle: CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  background: 'hsl(var(--success) / 0.2)',
  color: 'hsl(var(--success))',
  border: '1px solid hsl(var(--success))',
  borderRadius: 999,
  padding: '1px 6px',
}

const descStyle: CSSProperties = {
  fontSize: 12,
  color: 'hsl(var(--text-dim))',
  lineHeight: 1.45,
}

const metaStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'hsl(var(--text-muted))',
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
}

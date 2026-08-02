import type { CSSProperties } from 'react'
import type { ReleaseInfo } from '@tmbk/canshift-core'
import { useFlashHistoryStore } from '../../stores/flash-history.store'

export interface FirmwareSidePanelProps {
  release: ReleaseInfo | null
}

const NOTE_MAX_LINES = 12

const noteLines = (notes: string): string[] =>
  notes
    .split('\n')
    .map((line) => line.replace(/^[-*#>\s]+/, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, NOTE_MAX_LINES)

const formatHistoryDate = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toISOString().slice(5, 10).replace('-', '/')
}

export const FirmwareSidePanel = ({ release }: FirmwareSidePanelProps) => {
  const history = useFlashHistoryStore((s) => s.entries)
  const lines = release ? noteLines(release.notes) : []

  return (
    <aside style={panelStyle}>
      <div style={sectionHeaderStyle}>{release ? `CHANGELOG ${release.tag}` : 'CHANGELOG'}</div>
      <div style={changelogStyle}>
        {lines.length === 0 && (
          <div style={emptyStyle}>
            {release ? 'This release has no notes.' : 'Pick a build to see its release notes.'}
          </div>
        )}
        {lines.map((line, i) => (
          <div key={i} style={i === 0 ? firstNoteStyle : noteStyle}>
            {line}
          </div>
        ))}
      </div>
      <div style={sectionHeaderStyle}>FLASH HISTORY</div>
      <div style={historyStyle}>
        {history.length === 0 && <div style={emptyStyle}>No flashes from this browser yet.</div>}
        {history.map((entry, i) => (
          <div key={i} style={historyRowStyle}>
            <span>{entry.label}</span>
            <span>
              {formatHistoryDate(entry.at)} ·{' '}
              {entry.ok ? 'ok' : <span style={failedStyle}>failed</span>}
            </span>
          </div>
        ))}
      </div>
    </aside>
  )
}

const panelStyle: CSSProperties = {
  width: 392,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  borderLeft: '2px solid var(--brand-divider)',
  background: 'hsl(var(--brand-neutral-100))',
}

const sectionHeaderStyle: CSSProperties = {
  padding: '16px 24px 13px',
  borderBottom: '2px solid var(--brand-divider)',
  fontWeight: 800,
  fontSize: 10,
  letterSpacing: '0.2em',
  color: 'hsl(var(--brand-neutral-600))',
}

const changelogStyle: CSSProperties = {
  padding: '18px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
  fontSize: 13,
  color: 'hsl(var(--brand-neutral-700))',
  borderBottom: '2px solid var(--brand-divider)',
  overflowY: 'auto',
  maxHeight: '45%',
}

const firstNoteStyle: CSSProperties = {
  borderLeft: '2px solid hsl(var(--brand-accent))',
  paddingLeft: 13,
}

const noteStyle: CSSProperties = {
  borderLeft: '2px solid hsl(var(--brand-neutral-400))',
  paddingLeft: 13,
}

const historyStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'hsl(var(--brand-neutral-700))',
}

const historyRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '11px 24px',
  borderBottom: '1px solid hsl(var(--brand-neutral-300))',
}

const failedStyle: CSSProperties = {
  color: 'hsl(var(--brand-accent))',
}

const emptyStyle: CSSProperties = {
  fontSize: 12,
  color: 'hsl(var(--brand-neutral-500))',
}

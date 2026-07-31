import type { CSSProperties } from 'react'
import { useEffect, useRef } from 'react'

export type CliEntryKind = 'request' | 'ok' | 'error' | 'info'

export interface CliEntry {
  id: number
  kind: CliEntryKind
  timestamp: Date
  label: string
  payload?: Record<string, unknown> | null
}

export interface CliOutputProps {
  entries: readonly CliEntry[]
  onClear: () => void
}

export const CliOutput = ({ entries, onClear }: CliOutputProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const lastIdRef = useRef<number | null>(null)

  useEffect(() => {
    const last = entries[entries.length - 1]
    if (!last) return
    if (last.id === lastIdRef.current) return
    lastIdRef.current = last.id
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [entries])

  return (
    <div style={wrapperStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>Console</span>
        <button
          type="button"
          onClick={onClear}
          disabled={entries.length === 0}
          style={clearButtonStyle(entries.length === 0)}
        >
          Clear
        </button>
      </div>
      <div ref={scrollRef} style={streamStyle}>
        {entries.length === 0 ? (
          <div style={emptyStyle}>Send a command to see the response here.</div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} style={entryStyle}>
              <span style={timestampStyle}>{formatTime(entry.timestamp)}</span>
              <span style={{ ...kindStyle, color: kindColor(entry.kind) }}>
                {kindLabel(entry.kind)}
              </span>
              <span style={labelStyle}>{entry.label}</span>
              {entry.payload && Object.keys(entry.payload).length > 0 && (
                <pre style={payloadStyle}>{formatPayload(entry.payload)}</pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

const formatTime = (d: Date): string => {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${h}:${m}:${s}.${ms}`
}

const kindLabel = (kind: CliEntryKind): string => {
  switch (kind) {
    case 'request':
      return '→'
    case 'ok':
      return '✓'
    case 'error':
      return '✗'
    case 'info':
      return 'ℹ'
  }
}

const kindColor = (kind: CliEntryKind): string => {
  switch (kind) {
    case 'request':
      return 'hsl(var(--brand-accent))'
    case 'ok':
      return 'hsl(var(--success))'
    case 'error':
      return 'hsl(var(--destructive))'
    case 'info':
      return 'hsl(var(--text-dim))'
  }
}

const formatPayload = (payload: Record<string, unknown>): string => {
  try {
    return JSON.stringify(payload, null, 2)
  } catch {
    return String(payload)
  }
}

const wrapperStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  background: 'hsl(var(--surface))',
  border: '1px solid hsl(var(--border))',
  overflow: 'hidden',
}

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 14px',
  borderBottom: '1px solid hsl(var(--border))',
  background: 'hsl(var(--bg))',
}

const titleStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'hsl(var(--text-muted))',
}

const clearButtonStyle = (disabled: boolean): CSSProperties => ({
  background: disabled ? 'hsl(var(--bg-inset))' : 'hsl(var(--surface))',
  color: disabled ? 'hsl(var(--text-muted))' : 'hsl(var(--text-dim))',
  border: '1px solid hsl(var(--border))',
  padding: '3px 10px',
  fontSize: 10,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  cursor: disabled ? 'not-allowed' : 'pointer',
})

const streamStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '10px 14px',
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 12,
}

const emptyStyle: CSSProperties = {
  padding: '32px 0',
  textAlign: 'center',
  fontSize: 12,
  color: 'hsl(var(--text-muted))',
  fontFamily: 'system-ui, sans-serif',
}

const entryStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto auto 1fr',
  alignItems: 'baseline',
  gap: 10,
  padding: '4px 0',
  borderBottom: '1px solid hsl(var(--border) / 0.5)',
}

const timestampStyle: CSSProperties = {
  color: 'hsl(var(--text-muted))',
  fontVariantNumeric: 'tabular-nums',
}

const kindStyle: CSSProperties = {
  fontWeight: 600,
  textAlign: 'center',
  width: 14,
}

const labelStyle: CSSProperties = {
  color: 'hsl(var(--text))',
  wordBreak: 'break-word',
}

const payloadStyle: CSSProperties = {
  gridColumn: '3 / span 1',
  margin: '4px 0 0',
  padding: '6px 10px',
  background: 'hsl(var(--bg))',
  border: '1px solid hsl(var(--border))',
  fontSize: 11,
  color: 'hsl(var(--text-dim))',
  whiteSpace: 'pre-wrap',
}

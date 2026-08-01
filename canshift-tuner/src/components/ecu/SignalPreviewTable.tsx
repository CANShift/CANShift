import type { CSSProperties } from 'react'
import type { SignalDef } from '@tmbk/canshift-core'

export interface SignalPreviewTableProps {
  signals: readonly SignalDef[]
  warnings?: readonly string[]
}

export const SignalPreviewTable = ({ signals, warnings = [] }: SignalPreviewTableProps) => {
  if (signals.length === 0 && warnings.length === 0) {
    return <div style={emptyStyle}>No signals to preview.</div>
  }

  const frameGroups = groupByFrame(signals)

  return (
    <div style={wrapperStyle}>
      {warnings.length > 0 && (
        <div style={warningsBlockStyle}>
          <div style={warningsTitleStyle}>
            {warnings.length} parser warning{warnings.length === 1 ? '' : 's'}
          </div>
          <ul style={warningsListStyle}>
            {warnings.map((w, i) => (
              <li key={i} style={warningItemStyle}>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div style={summaryStyle}>
        {signals.length} signal{signals.length === 1 ? '' : 's'} across {frameGroups.length} frame
        {frameGroups.length === 1 ? '' : 's'}
      </div>
      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Frame</th>
              <th style={thNumStyle}>Byte</th>
              <th style={thNumStyle}>Len</th>
              <th style={thNumStyle}>Scale</th>
              <th style={thNumStyle}>Offset</th>
              <th style={thNumStyle}>Range</th>
              <th style={thStyle}>Unit</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s) => (
              <tr key={s.name} style={rowStyle}>
                <td style={tdNameStyle}>{s.name}</td>
                <td style={tdMonoStyle}>{s.canFrameId}</td>
                <td style={tdNumStyle}>{String(s.startByte)}</td>
                <td style={tdNumStyle}>{String(s.byteLength)}</td>
                <td style={tdNumStyle}>{formatNumber(s.scale)}</td>
                <td style={tdNumStyle}>{formatNumber(s.offset)}</td>
                <td style={tdNumStyle}>
                  {formatNumber(s.min)} – {formatNumber(s.max)}
                </td>
                <td style={tdMutedStyle}>{s.unit || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const groupByFrame = (signals: readonly SignalDef[]): string[] => {
  const set = new Set<string>()
  for (const s of signals) set.add(s.canFrameId)
  return Array.from(set)
}

const formatNumber = (n: number): string => {
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(3).replace(/\.?0+$/, '')
}

const wrapperStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  flex: 1,
  minHeight: 0,
}

const summaryStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'hsl(var(--text-muted))',
}

const tableWrapStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--surface))',
}

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: 0,
  fontSize: 12,
}

const thStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  background: 'hsl(var(--surface))',
  padding: '10px 12px',
  borderBottom: '1px solid hsl(var(--border))',
  textAlign: 'left',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'hsl(var(--text-muted))',
}

const thNumStyle: CSSProperties = {
  ...thStyle,
  textAlign: 'right',
}

const rowStyle: CSSProperties = {
  borderBottom: '1px solid hsl(var(--border))',
}

const tdBase: CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid hsl(var(--border))',
  fontSize: 12,
  color: 'hsl(var(--text))',
}

const tdNameStyle: CSSProperties = {
  ...tdBase,
  fontWeight: 500,
}

const tdMonoStyle: CSSProperties = {
  ...tdBase,
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  color: 'hsl(var(--text-dim))',
}

const tdNumStyle: CSSProperties = {
  ...tdBase,
  textAlign: 'right',
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontVariantNumeric: 'tabular-nums',
  color: 'hsl(var(--text-dim))',
}

const tdMutedStyle: CSSProperties = {
  ...tdBase,
  color: 'hsl(var(--text-muted))',
}

const emptyStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'hsl(var(--text-muted))',
  fontSize: 13,
}

const warningsBlockStyle: CSSProperties = {
  padding: '10px 12px',
  background: 'hsl(var(--accent) / 0.12)',
  border: '1px solid hsl(var(--accent))',
  color: 'hsl(var(--text))',
}

const warningsTitleStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'hsl(var(--accent))',
  marginBottom: 6,
}

const warningsListStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const warningItemStyle: CSSProperties = {
  fontSize: 12,
  color: 'hsl(var(--text-dim))',
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
}

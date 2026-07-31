import type { CSSProperties } from 'react'
import type { CanFrameStats } from '../../hooks/useCanScanner'

const MAX_BARS_PER_BYTE = 16

export interface CanByteHistogramProps {
  frame: CanFrameStats
}

export const CanByteHistogram = ({ frame }: CanByteHistogramProps) => {
  return (
    <div style={containerStyle}>
      <div style={headerStyle}>Per-byte value distribution (most-common first)</div>
      <div style={gridStyle}>
        {frame.byteValueCounts.slice(0, frame.lastDlc).map((counts, byteIndex) => (
          <ByteColumn key={byteIndex} byteIndex={byteIndex} counts={counts} />
        ))}
      </div>
    </div>
  )
}

interface ByteColumnProps {
  byteIndex: number
  counts: ReadonlyMap<number, number>
}

const ByteColumn = ({ byteIndex, counts }: ByteColumnProps) => {
  if (counts.size === 0) {
    return (
      <div style={columnStyle}>
        <div style={columnHeaderStyle}>byte {byteIndex}</div>
        <div style={emptyStyle}>—</div>
      </div>
    )
  }

  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_BARS_PER_BYTE)
  const max = sorted[0]?.[1] ?? 1
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0)
  const distinct = counts.size
  const constant = distinct === 1

  return (
    <div style={columnStyle}>
      <div style={columnHeaderStyle}>
        <span>byte {byteIndex}</span>
        <span style={distinctTagStyle(constant)}>
          {constant ? 'const' : `${String(distinct)} vals`}
        </span>
      </div>
      <div style={barsStyle}>
        {sorted.map(([value, count]) => (
          <div key={value} style={barRowStyle}>
            <span style={byteLabelStyle}>{formatByte(value)}</span>
            <div style={barTrackStyle}>
              <div
                style={{
                  ...barFillStyle,
                  width: `${String((count / max) * 100)}%`,
                  background: constant ? 'hsl(var(--text-muted))' : 'hsl(var(--brand-accent))',
                }}
              />
            </div>
            <span style={barCountStyle}>{formatPct(count, total)}</span>
          </div>
        ))}
        {counts.size > MAX_BARS_PER_BYTE && (
          <div style={overflowStyle}>+ {String(counts.size - MAX_BARS_PER_BYTE)} more</div>
        )}
      </div>
    </div>
  )
}

const formatByte = (value: number): string => {
  return `0x${value.toString(16).toUpperCase().padStart(2, '0')}`
}

const formatPct = (count: number, total: number): string => {
  if (total === 0) return '0 %'
  return `${((count / total) * 100).toFixed(0)} %`
}

const containerStyle: CSSProperties = {
  padding: '12px 14px 16px',
  background: 'hsl(var(--bg-inset))',
  borderTop: '1px solid hsl(var(--border))',
}

const headerStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'hsl(var(--text-muted))',
  marginBottom: 8,
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
  gap: 12,
}

const columnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}

const columnHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: 10,
  color: 'hsl(var(--text-dim))',
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
}

const distinctTagStyle = (constant: boolean): CSSProperties => ({
  fontSize: 9,
  color: constant ? 'hsl(var(--text-muted))' : 'hsl(var(--brand-accent))',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
})

const emptyStyle: CSSProperties = {
  fontSize: 11,
  color: 'hsl(var(--text-muted))',
}

const barsStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
}

const barRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 10,
}

const byteLabelStyle: CSSProperties = {
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  color: 'hsl(var(--text-dim))',
  minWidth: 32,
}

const barTrackStyle: CSSProperties = {
  flex: 1,
  height: 6,
  background: 'hsl(var(--bg))',
  borderRadius: 2,
  overflow: 'hidden',
}

const barFillStyle: CSSProperties = {
  height: '100%',
}

const barCountStyle: CSSProperties = {
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontVariantNumeric: 'tabular-nums',
  color: 'hsl(var(--text-muted))',
  minWidth: 30,
  textAlign: 'right',
}

const overflowStyle: CSSProperties = {
  fontSize: 10,
  color: 'hsl(var(--text-muted))',
  fontStyle: 'italic',
}

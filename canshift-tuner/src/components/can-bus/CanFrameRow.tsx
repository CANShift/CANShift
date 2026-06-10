import type { CSSProperties } from 'react'
import { useState } from 'react'
import { Button } from '../ui/button'
import { CanByteHistogram } from './CanByteHistogram'
import type { CanFrameStats } from '../../hooks/useCanScanner'

export interface CanFrameRowProps {
  frame: CanFrameStats
  nowMs: number
  onPromote: (id: number) => void
}

export const CanFrameRow = ({ frame, nowMs, onPromote }: CanFrameRowProps) => {
  const [expanded, setExpanded] = useState(false)
  const idHex = formatCanId(frame.id)
  const stale = nowMs - frame.lastSeenMs > 2_000

  return (
    <>
      <tr style={rowStyle(stale)}>
        <td style={idCellStyle}>
          <button
            type="button"
            onClick={() => {
              setExpanded((v) => !v)
            }}
            style={expandButtonStyle}
            aria-label={expanded ? 'Collapse byte histogram' : 'Expand byte histogram'}
          >
            <span style={{ display: 'inline-block', width: 10 }}>{expanded ? '▾' : '▸'}</span>
            {idHex}
          </button>
        </td>
        <td style={numCellStyle}>{formatRelative(nowMs - frame.firstSeenMs)}</td>
        <td style={numCellStyle}>{formatRelative(nowMs - frame.lastSeenMs)}</td>
        <td style={numCellStyle}>{formatCount(frame.count)}</td>
        <td style={numCellStyle}>{String(frame.rateHz)} Hz</td>
        <td style={dlcCellStyle}>{String(frame.lastDlc)}</td>
        <td style={payloadCellStyle}>{formatPayload(frame.lastPayload, frame.lastDlc)}</td>
        <td style={actionCellStyle}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onPromote(frame.id)
            }}
          >
            Promote
          </Button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} style={expandedCellStyle}>
            <CanByteHistogram frame={frame} />
          </td>
        </tr>
      )}
    </>
  )
}

const formatCanId = (id: number): string => {
  const extended = id > 0x7ff
  const width = extended ? 8 : 3
  return `0x${id.toString(16).toUpperCase().padStart(width, '0')}`
}

const formatRelative = (ms: number): string => {
  if (ms < 1_000) return '<1s'
  if (ms < 60_000) return `${String(Math.floor(ms / 1_000))}s ago`
  return `${String(Math.floor(ms / 60_000))}m ago`
}

const formatCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

const formatPayload = (bytes: readonly number[], dlc: number): string => {
  const slice = bytes.slice(0, dlc)
  return slice.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')
}

const rowStyle = (stale: boolean): CSSProperties => ({
  background: 'transparent',
  opacity: stale ? 0.55 : 1,
  transition: 'opacity 200ms linear',
})

const cellStyle: CSSProperties = {
  padding: '8px 14px',
  borderBottom: '1px solid hsl(var(--border))',
  fontSize: 12,
  color: 'hsl(var(--text))',
  verticalAlign: 'middle',
}

const idCellStyle: CSSProperties = {
  ...cellStyle,
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontWeight: 600,
}

const numCellStyle: CSSProperties = {
  ...cellStyle,
  textAlign: 'right',
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  color: 'hsl(var(--text-dim))',
  fontVariantNumeric: 'tabular-nums',
}

const dlcCellStyle: CSSProperties = {
  ...cellStyle,
  textAlign: 'center',
  color: 'hsl(var(--text-dim))',
}

const payloadCellStyle: CSSProperties = {
  ...cellStyle,
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  color: 'hsl(var(--text-dim))',
  letterSpacing: '0.04em',
}

const actionCellStyle: CSSProperties = {
  ...cellStyle,
  textAlign: 'right',
}

const expandButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  color: 'inherit',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  fontWeight: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
}

const expandedCellStyle: CSSProperties = {
  padding: 0,
  borderBottom: '1px solid hsl(var(--border))',
}

import type { CSSProperties } from 'react'
import { useState } from 'react'
import { CanByteHistogram } from './CanByteHistogram'
import type { CanFrameStats } from '../../hooks/useCanScanner'
import { MONO_FONT } from '../../lib/typography'

export interface CanFrameRowProps {
  frame: CanFrameStats
  nowMs: number
  mappedName: string | null
  onPromote: (id: number) => void
}

const STALE_AFTER_MS = 2_000

export const CanFrameRow = ({ frame, nowMs, mappedName, onPromote }: CanFrameRowProps) => {
  const [expanded, setExpanded] = useState(false)
  const idHex = formatCanId(frame.id)
  const stale = nowMs - frame.lastSeenMs > STALE_AFTER_MS

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
        <td style={dlcCellStyle}>{String(frame.lastDlc)}</td>
        <td style={dataCellStyle}>{formatPayload(frame.lastPayload, frame.lastDlc)}</td>
        <td style={dimCellStyle}>{String(frame.rateHz)} Hz</td>
        <td style={dimCellStyle}>{formatCount(frame.count)}</td>
        <td style={mappedCellStyle}>
          {mappedName ?? (
            <button
              type="button"
              className="editor-ghost-accent"
              onClick={() => {
                onPromote(frame.id)
              }}
              style={promoteButtonStyle}
            >
              PROMOTE
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} style={expandedCellStyle}>
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
  padding: '12px 20px 12px 0',
  borderBottom: '1px solid hsl(var(--brand-neutral-300))',
  fontFamily: MONO_FONT,
  fontSize: 13,
  color: 'hsl(var(--brand-text))',
  verticalAlign: 'middle',
  fontVariantNumeric: 'tabular-nums',
}

const idCellStyle: CSSProperties = {
  ...cellStyle,
  paddingLeft: 20,
  color: 'hsl(var(--brand-accent))',
}

const dlcCellStyle: CSSProperties = {
  ...cellStyle,
  color: 'hsl(var(--brand-neutral-600))',
}

const dataCellStyle: CSSProperties = {
  ...cellStyle,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const dimCellStyle: CSSProperties = {
  ...cellStyle,
  color: 'hsl(var(--brand-neutral-700))',
}

const mappedCellStyle: CSSProperties = {
  ...cellStyle,
  fontFamily: 'var(--font-ui)',
  fontSize: 12,
}

const promoteButtonStyle: CSSProperties = {
  padding: '3px 10px',
  background: 'none',
  border: '1px solid hsl(var(--brand-accent))',
  fontWeight: 800,
  fontSize: 10,
  letterSpacing: '0.08em',
  color: 'hsl(var(--brand-accent))',
  cursor: 'pointer',
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
  padding: '0 0 0 20px',
  borderBottom: '1px solid hsl(var(--brand-neutral-300))',
}

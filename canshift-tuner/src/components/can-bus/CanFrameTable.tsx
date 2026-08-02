import type { CSSProperties } from 'react'
import { CanFrameRow } from './CanFrameRow'
import type { CanFrameStats } from '../../hooks/useCanScanner'

export interface CanFrameTableProps {
  frames: readonly CanFrameStats[]
  nowMs: number
  mappedTo: ReadonlyMap<number, string>
  onPromote: (id: number) => void
}

const COLUMN_WIDTHS = [110, 70, null, 100, 110, 180] as const

export const CanFrameTable = ({ frames, nowMs, mappedTo, onPromote }: CanFrameTableProps) => {
  if (frames.length === 0) {
    return (
      <div style={emptyStyle}>
        No frames captured yet. Start the scan and wait for the bus to send something.
      </div>
    )
  }

  return (
    <div style={wrapperStyle}>
      <table style={tableStyle}>
        <colgroup>
          {COLUMN_WIDTHS.map((width, i) => (
            <col key={i} style={width === null ? undefined : { width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th style={thFirstStyle}>ID</th>
            <th style={thStyle}>DLC</th>
            <th style={thStyle}>DATA</th>
            <th style={thStyle}>RATE</th>
            <th style={thStyle}>COUNT</th>
            <th style={thStyle}>MAPPED TO</th>
          </tr>
        </thead>
        <tbody>
          {frames.map((f) => (
            <CanFrameRow
              key={f.id}
              frame={f}
              nowMs={nowMs}
              mappedName={mappedTo.get(f.id) ?? null}
              onPromote={onPromote}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

const wrapperStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
}

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: 0,
  tableLayout: 'fixed',
}

const thStyle: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 1,
  background: 'hsl(var(--brand-chrome-bg))',
  padding: '11px 20px 11px 0',
  borderBottom: '2px solid var(--brand-divider)',
  textAlign: 'left',
  fontWeight: 800,
  fontSize: 10,
  letterSpacing: '0.18em',
  color: 'hsl(var(--brand-neutral-600))',
}

const thFirstStyle: CSSProperties = {
  ...thStyle,
  paddingLeft: 20,
}

const emptyStyle: CSSProperties = {
  padding: '64px 24px',
  textAlign: 'center',
  fontSize: 13,
  color: 'hsl(var(--brand-neutral-500))',
}

import type { CSSProperties } from 'react'
import { CanFrameRow } from './CanFrameRow'
import { uiLabelStyle } from '../../lib/typography'
import type { CanFrameStats } from '../../hooks/useCanScanner'

export interface CanFrameTableProps {
  frames: readonly CanFrameStats[]
  nowMs: number
  onPromote: (id: number) => void
}

export const CanFrameTable = ({ frames, nowMs, onPromote }: CanFrameTableProps) => {
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
        <thead>
          <tr>
            <th style={thStyle}>ID</th>
            <th style={thNumStyle}>First seen</th>
            <th style={thNumStyle}>Last seen</th>
            <th style={thNumStyle}>Count</th>
            <th style={thNumStyle}>Rate</th>
            <th style={thCenterStyle}>DLC</th>
            <th style={thStyle}>Last payload</th>
            <th style={thActionStyle}></th>
          </tr>
        </thead>
        <tbody>
          {frames.map((f) => (
            <CanFrameRow key={f.id} frame={f} nowMs={nowMs} onPromote={onPromote} />
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
  fontSize: 12,
}

const thStyle: CSSProperties = {
  ...uiLabelStyle,
  position: 'sticky',
  top: 0,
  background: 'hsl(var(--bg))',
  padding: '10px 14px',
  borderBottom: '1px solid hsl(var(--border))',
  textAlign: 'left',
  color: 'hsl(var(--text-muted))',
  zIndex: 1,
}

const thNumStyle: CSSProperties = {
  ...thStyle,
  textAlign: 'right',
}

const thCenterStyle: CSSProperties = {
  ...thStyle,
  textAlign: 'center',
}

const thActionStyle: CSSProperties = {
  ...thStyle,
  width: 100,
}

const emptyStyle: CSSProperties = {
  padding: '64px 24px',
  textAlign: 'center',
  fontSize: 13,
  color: 'hsl(var(--text-dim))',
}

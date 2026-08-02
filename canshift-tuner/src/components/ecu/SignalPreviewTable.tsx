import type { CSSProperties } from 'react'
import type { SignalDef } from '@tmbk/canshift-core'
import { MONO_FONT } from '../../lib/typography'

export interface SignalPreviewTableProps {
  signals: readonly SignalDef[]
  boundTo: ReadonlyMap<string, string>
  warnings?: readonly string[]
}

export const SignalPreviewTable = ({
  signals,
  boundTo,
  warnings = [],
}: SignalPreviewTableProps) => {
  if (signals.length === 0 && warnings.length === 0) {
    return <div style={emptyStyle}>No signals to preview.</div>
  }

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
      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <colgroup>
            <col style={{ width: 160 }} />
            <col style={{ width: 96 }} />
            <col style={{ width: 84 }} />
            <col style={{ width: 84 }} />
            <col style={{ width: 84 }} />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th style={thFirstStyle}>SIGNAL</th>
              <th style={thStyle}>CAN ID</th>
              <th style={thStyle}>BYTES</th>
              <th style={thStyle}>SCALE</th>
              <th style={thStyle}>UNIT</th>
              <th style={thStyle}>BOUND TO</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s) => {
              const bound = boundTo.get(s.name) ?? null
              return (
                <tr key={s.name}>
                  <td style={tdFirstStyle}>{s.name}</td>
                  <td style={tdIdStyle}>{s.canFrameId}</td>
                  <td style={tdDimStyle}>{formatBytes(s.startByte, s.byteLength)}</td>
                  <td style={tdDimStyle}>{formatNumber(s.scale)}</td>
                  <td style={tdDimStyle}>{s.unit || '—'}</td>
                  <td style={bound ? tdBoundStyle : tdUnboundStyle}>{bound ?? 'not bound'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const formatBytes = (start: number, length: number): string =>
  length <= 1 ? String(start) : `${String(start)}–${String(start + length - 1)}`

const formatNumber = (n: number): string => {
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(3).replace(/\.?0+$/, '')
}

const wrapperStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
}

const tableWrapStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
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

const tdBase: CSSProperties = {
  padding: '12px 20px 12px 0',
  borderBottom: '1px solid hsl(var(--brand-neutral-300))',
  fontFamily: MONO_FONT,
  fontSize: 13,
  color: 'hsl(var(--brand-text))',
  fontVariantNumeric: 'tabular-nums',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const tdFirstStyle: CSSProperties = {
  ...tdBase,
  paddingLeft: 20,
}

const tdIdStyle: CSSProperties = {
  ...tdBase,
  color: 'hsl(var(--brand-accent))',
}

const tdDimStyle: CSSProperties = {
  ...tdBase,
  color: 'hsl(var(--brand-neutral-600))',
}

const tdBoundStyle: CSSProperties = {
  ...tdBase,
  fontFamily: 'var(--font-ui)',
  fontSize: 12,
}

const tdUnboundStyle: CSSProperties = {
  ...tdBase,
  fontFamily: 'var(--font-ui)',
  fontSize: 12,
  color: 'hsl(var(--brand-neutral-500))',
}

const emptyStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'hsl(var(--brand-neutral-500))',
  fontSize: 13,
}

const warningsBlockStyle: CSSProperties = {
  margin: '12px 20px 0',
  padding: '10px 12px',
  border: '1px solid hsl(var(--brand-accent))',
  background: 'color-mix(in srgb, hsl(var(--brand-accent)) 8%, transparent)',
}

const warningsTitleStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.18em',
  color: 'hsl(var(--brand-accent))',
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
  color: 'hsl(var(--brand-neutral-700))',
  fontFamily: MONO_FONT,
}

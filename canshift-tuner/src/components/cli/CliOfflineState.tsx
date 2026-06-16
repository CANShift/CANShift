import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Button } from '@/components/ui/button'
import { useConnectionStore } from '../../stores/connection.store'
import { KNOWN_OPCODES } from '../../transport'

const formatHex = (id: number): string => `0x${id.toString(16).toUpperCase().padStart(2, '0')}`

export const CliOfflineState = () => {
  const status = useConnectionStore((s) => s.status)
  const connect = useConnectionStore((s) => s.connect)
  const [opcodesOpen, setOpcodesOpen] = useState(false)

  const busy = status === 'connecting' || status === 'reconnecting'

  return (
    <div style={containerStyle}>
      <div style={emptyStateStyle}>
        <div style={titleStyle}>No device connected</div>
        <div style={bodyStyle}>Connect a device to send raw firmware commands over USB.</div>
        <Button
          type="button"
          onClick={() => {
            void connect()
          }}
          disabled={busy}
        >
          {busy ? (status === 'reconnecting' ? 'Reconnecting…' : 'Connecting…') : 'Connect device'}
        </Button>
      </div>

      <div style={opcodesSectionStyle}>
        <button
          type="button"
          style={opcodesToggleStyle}
          onClick={() => {
            setOpcodesOpen((v) => !v)
          }}
          aria-expanded={opcodesOpen}
        >
          <span>Known opcodes ({String(KNOWN_OPCODES.length)})</span>
          <span style={chevronStyle(opcodesOpen)}>▸</span>
        </button>
        {opcodesOpen && (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Hex</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Description</th>
              </tr>
            </thead>
            <tbody>
              {KNOWN_OPCODES.map((op) => (
                <tr key={op.id}>
                  <td style={tdHexStyle}>{formatHex(op.id)}</td>
                  <td style={tdNameStyle}>{op.name}</td>
                  <td style={tdDescStyle}>{op.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const containerStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
  alignItems: 'stretch',
  minHeight: 0,
  overflow: 'auto',
}

const emptyStateStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
  padding: '48px 16px 32px',
  textAlign: 'center',
}

const titleStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: 'hsl(var(--text))',
}

const bodyStyle: CSSProperties = {
  fontSize: 13,
  color: 'hsl(var(--text-dim))',
  maxWidth: 360,
}

const opcodesSectionStyle: CSSProperties = {
  borderTop: '1px solid hsl(var(--border))',
  paddingTop: 16,
}

const opcodesToggleStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: '8px 12px',
  background: 'transparent',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  color: 'hsl(var(--text))',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
}

const chevronStyle = (open: boolean): CSSProperties => ({
  display: 'inline-block',
  transition: 'transform 120ms',
  transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
  fontSize: 11,
  color: 'hsl(var(--text-dim))',
})

const tableStyle: CSSProperties = {
  width: '100%',
  marginTop: 12,
  borderCollapse: 'collapse',
  fontSize: 12,
  color: 'hsl(var(--text))',
}

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '1px solid hsl(var(--border))',
  color: 'hsl(var(--text-dim))',
  fontWeight: 500,
  textTransform: 'uppercase',
  fontSize: 10,
  letterSpacing: '0.04em',
}

const tdHexStyle: CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid hsl(var(--border) / 0.5)',
  fontFamily: 'ui-monospace, monospace',
  color: 'hsl(var(--accent))',
  whiteSpace: 'nowrap',
}

const tdNameStyle: CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid hsl(var(--border) / 0.5)',
  fontFamily: 'ui-monospace, monospace',
  whiteSpace: 'nowrap',
}

const tdDescStyle: CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid hsl(var(--border) / 0.5)',
  color: 'hsl(var(--text-dim))',
}

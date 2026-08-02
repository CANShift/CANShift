import type { CSSProperties } from 'react'

export const DtcPanel = () => (
  <aside style={panelStyle}>
    <div style={headerStyle}>TROUBLE CODES</div>
    <div style={emptyStyle}>
      No trouble codes read. Reading and clearing DTCs needs Mode 03/04 support on the device link —
      tracked in #1883.
    </div>
    <div style={footerStyle}>
      <button
        type="button"
        disabled
        title="Requires Mode 04 support on the device link (#1883)"
        style={clearButtonStyle}
      >
        CLEAR CODES
      </button>
    </div>
  </aside>
)

const panelStyle: CSSProperties = {
  width: 360,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  borderLeft: '2px solid var(--brand-divider)',
  background: 'hsl(var(--brand-neutral-100))',
}

const headerStyle: CSSProperties = {
  padding: '14px 20px',
  borderBottom: '2px solid var(--brand-divider)',
  fontWeight: 800,
  fontSize: 10,
  letterSpacing: '0.2em',
  color: 'hsl(var(--brand-neutral-600))',
}

const emptyStyle: CSSProperties = {
  flex: 1,
  padding: '16px 20px',
  fontSize: 12,
  lineHeight: 1.5,
  color: 'hsl(var(--brand-neutral-500))',
}

const footerStyle: CSSProperties = {
  padding: '14px 20px',
  borderTop: '1px solid hsl(var(--brand-neutral-300))',
}

const clearButtonStyle: CSSProperties = {
  padding: '6px 14px',
  background: 'none',
  border: '1px solid hsl(var(--brand-accent))',
  fontWeight: 800,
  fontSize: 11,
  letterSpacing: '0.09em',
  color: 'hsl(var(--brand-accent))',
  cursor: 'not-allowed',
  opacity: 0.5,
}

// App.tsx — Tuner shell placeholder.
//
// Will be replaced by the Shell agent (Betaflight-style sidebar + header +
// route outlet). This stub exists so the package compiles end-to-end before
// the full layout lands.

export default function App() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'hsl(var(--bg))',
        color: 'hsl(var(--text))',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>CANShift Tuner</h1>
        <p style={{ color: 'hsl(var(--text-dim))', fontSize: 13 }}>
          Shell + Welcome + Dashboard wire up — see PR #1.
        </p>
      </div>
    </div>
  )
}

// TopBar.tsx — Minimal dash-hosted shell top bar (phase 1, #1104).
//
// The Electron TopBar pulled in `useConfigActions`, `ConnectModal`, USB
// icons, log store, and the menu IPC. None of that ships in phase 1. This
// shell keeps the visual rhythm (title left, action buttons right) so the
// editor frame doesn't look unbalanced when measured.

import { useDeviceStore } from '../../stores/device.store'

const BAR_HEIGHT = 36

export default function TopBar() {
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const enterSimulation = useDeviceStore((s) => s.enterSimulation)
  const exitSimulation = useDeviceStore((s) => s.exitSimulation)

  let statusLabel: string
  if (connected) statusLabel = 'Connected'
  else if (simulationMode) statusLabel = 'Simulation'
  else statusLabel = 'Offline'

  return (
    <header
      style={{
        height: BAR_HEIGHT,
        flexShrink: 0,
        background: 'hsl(var(--surface))',
        borderBottom: '1px solid hsl(var(--border))',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 12,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text))' }}>
        CANShift Studio
      </div>
      <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Web — Phase 1 spike
      </div>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 11, color: 'hsl(var(--text-dim))' }}>{statusLabel}</span>
      <button
        type="button"
        onClick={() => {
          if (simulationMode) exitSimulation()
          else enterSimulation()
        }}
        style={{
          background: simulationMode ? 'hsl(var(--accent))' : 'transparent',
          color: simulationMode ? 'hsl(var(--accent-foreground))' : 'hsl(var(--text-dim))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 4,
          padding: '4px 10px',
          fontSize: 11,
          cursor: 'pointer',
        }}
      >
        {simulationMode ? 'Exit sim' : 'Simulation'}
      </button>
    </header>
  )
}

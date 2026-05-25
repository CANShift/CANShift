// TopBar.tsx — Minimal dash-hosted shell top bar.
//
// Phase 1 spike was display-only. Phase 3 (#1077) wires the connect/disconnect
// affordances now that the WS transport is live: a disconnect button while
// connected, a simulation toggle while offline.

import { useDeviceStore } from '../../stores/device.store'
import { useConnectionStore } from '../../stores/connection.store'

const BAR_HEIGHT = 36

export default function TopBar() {
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const enterSimulation = useDeviceStore((s) => s.enterSimulation)
  const exitSimulation = useDeviceStore((s) => s.exitSimulation)
  const wifiHost = useDeviceStore((s) => s.wifiHost)
  const status = useConnectionStore((s) => s.status)
  const disconnect = useConnectionStore((s) => s.disconnect)

  let statusLabel: string
  if (connected) statusLabel = wifiHost ? `Connected — ${wifiHost}` : 'Connected'
  else if (simulationMode) statusLabel = 'Simulation'
  else if (status === 'connecting') statusLabel = 'Connecting…'
  else if (status === 'reconnecting') statusLabel = 'Reconnecting…'
  else statusLabel = 'Offline'

  const showDisconnect = connected && !simulationMode

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
      <div
        style={{
          fontSize: 10,
          color: 'hsl(var(--text-muted))',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        Web
      </div>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 11, color: 'hsl(var(--text-dim))' }}>{statusLabel}</span>
      {showDisconnect ? (
        <button
          type="button"
          onClick={() => {
            disconnect()
          }}
          style={{
            background: 'transparent',
            color: 'hsl(var(--text-dim))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 4,
            padding: '4px 10px',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          Disconnect
        </button>
      ) : (
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
      )}
    </header>
  )
}

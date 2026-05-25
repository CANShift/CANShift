// ConnectScreen.tsx — Empty-state surface when no device is connected and
// simulation mode is off (phase 1, #1104). The Electron equivalent opened
// `ConnectModal` and called `useConfigActions.loadFromFile`; here we just
// invite the user to flip simulation on so the editor mounts.

import { useDeviceStore } from '../../stores/device.store'

export default function ConnectScreen() {
  const enterSimulation = useDeviceStore((s) => s.enterSimulation)

  return (
    <main
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        color: 'hsl(var(--text-dim))',
      }}
    >
      <div style={{ fontSize: 14, color: 'hsl(var(--text))' }}>
        No device connected
      </div>
      <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', maxWidth: 380, textAlign: 'center' }}>
        Phase-1 spike: dash transport is stubbed. Enter simulation mode to render the
        editor against the bundled demo config.
      </div>
      <button
        type="button"
        onClick={() => {
          enterSimulation()
        }}
        style={{
          background: 'hsl(var(--primary))',
          color: 'hsl(var(--primary-foreground))',
          border: 'none',
          borderRadius: 4,
          padding: '8px 16px',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        Enter simulation
      </button>
    </main>
  )
}

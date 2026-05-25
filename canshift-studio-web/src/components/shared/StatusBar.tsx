// StatusBar.tsx — Minimal bottom status row (phase 1, #1104).
// Strips canHealth + appVersion stores; phase 3 re-introduces them on top of
// the dash WS feed.

import { useDashboardStore } from '../../stores/dashboard.store'
import { useDeviceStore } from '../../stores/device.store'

const BAR_HEIGHT = 22

export default function StatusBar() {
  const isDirty = useDashboardStore((s) => s.isDirty)
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion)

  let connectionLabel: string
  if (connected) connectionLabel = firmwareVersion ?? 'connected'
  else if (simulationMode) connectionLabel = 'sim'
  else connectionLabel = 'no device'

  return (
    <footer
      style={{
        height: BAR_HEIGHT,
        flexShrink: 0,
        background: 'hsl(var(--surface))',
        borderTop: '1px solid hsl(var(--border))',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        fontSize: 10,
        color: 'hsl(var(--text-muted))',
        gap: 16,
      }}
    >
      <span>{isDirty ? '● unsaved' : 'saved'}</span>
      <span>{connectionLabel}</span>
      <div style={{ flex: 1 }} />
      <span>v0.0.0-spike</span>
    </footer>
  )
}

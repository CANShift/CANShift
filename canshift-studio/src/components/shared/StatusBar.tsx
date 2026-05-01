// StatusBar.tsx — Bottom status bar showing connection and save state

import { useDeviceStore } from '../../stores/device.store'
import { useDashboardStore } from '../../stores/dashboard.store'
import { useCanHealthStore } from '../../stores/canHealth.store'

// A stat older than 6s is considered stale (firmware emits every ~2s).
const HEALTH_STALE_MS = 6_000

export default function StatusBar() {
  const connected = useDeviceStore((s) => s.connected)
  const portPath = useDeviceStore((s) => s.portPath)
  const isDirty = useDashboardStore((s) => s.isDirty)
  const canFps = useCanHealthStore((s) => s.fps)
  const canErrors = useCanHealthStore((s) => s.errors)
  const canUpdatedAt = useCanHealthStore((s) => s.updatedAt)

  return (
    <footer
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 18,
        background: '#0D0D0D',
        borderTop: '1px solid #2A2A2A',
        padding: '0 12px',
        fontSize: 11,
        color: '#555555',
      }}
    >
      <span>{connected && <span style={{ color: '#00CC44' }}>● Connected — {portPath}</span>}</span>

      <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {canFps !== null &&
          canUpdatedAt !== null &&
          Date.now() - canUpdatedAt < HEALTH_STALE_MS && (
            <span style={{ color: canErrors ? '#FF8800' : '#556655' }}>
              CAN {canFps.toFixed(1)}/s{canErrors ? ` · ${String(canErrors)} err` : ''}
            </span>
          )}
        {isDirty && <span style={{ color: '#FF8800' }}>Unsaved changes</span>}
      </span>

      <span>CANShift Studio v0.1.0</span>
    </footer>
  )
}

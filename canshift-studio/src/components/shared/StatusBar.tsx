// StatusBar.tsx — Bottom status bar showing connection and save state

import { useDeviceStore } from '../../stores/device.store'
import { useDashboardStore } from '../../stores/dashboard.store'

export default function StatusBar() {
  const connected = useDeviceStore((s) => s.connected)
  const portPath = useDeviceStore((s) => s.portPath)
  const isDirty = useDashboardStore((s) => s.isDirty)

  return (
    <footer
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 24,
        background: '#0D0D0D',
        borderTop: '1px solid #2A2A2A',
        padding: '0 12px',
        fontSize: 11,
        color: '#555555',
      }}
    >
      <span>
        {connected && <span style={{ color: '#00CC44' }}>● Connected — {portPath}</span>}
      </span>
      <span>{isDirty && <span style={{ color: '#FF8800' }}>Unsaved changes</span>}</span>
      <span>CANShift Studio v0.1.0</span>
    </footer>
  )
}

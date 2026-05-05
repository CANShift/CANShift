// StatusBar.tsx — Bottom status bar

import { useState, useEffect } from 'react'
import { useDeviceStore } from '../../stores/device.store'
import { useDashboardStore } from '../../stores/dashboard.store'
import { useCanHealthStore } from '../../stores/canHealth.store'
import { appIpc } from '../../services/ipc.service'

const HEALTH_STALE_MS = 6_000

export default function StatusBar() {
  const connected = useDeviceStore((s) => s.connected)
  const portPath = useDeviceStore((s) => s.portPath)
  const isDirty = useDashboardStore((s) => s.isDirty)
  const canFps = useCanHealthStore((s) => s.fps)
  const canErrors = useCanHealthStore((s) => s.errors)
  const canUpdatedAt = useCanHealthStore((s) => s.updatedAt)

  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    void appIpc.version().then(setVersion)
  }, [])

  const canFresh =
    canFps !== null && canUpdatedAt !== null && Date.now() - canUpdatedAt < HEALTH_STALE_MS
  const canFpsStr = canFresh ? `${canFps.toFixed(1)}/s` : null

  return (
    <footer
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 20,
        background: '#080808',
        borderTop: '1px solid #181818',
        padding: '0 12px',
        fontSize: 10,
        color: '#3A3A3A',
        letterSpacing: '0.03em',
        flexShrink: 0,
      }}
    >
      {/* Left — connection */}
      <span style={{ minWidth: 140 }}>
        {connected && <span style={{ color: '#3D7A4A' }}>● {portPath ?? 'connected'}</span>}
      </span>

      {/* Center — CAN health + dirty flag */}
      <span style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        {canFpsStr !== null && (
          <span style={{ color: canErrors ? '#7A4A20' : '#3A4A3A' }}>
            CAN {canFpsStr}
            {canErrors ? ` · ${String(canErrors)} err` : ''}
          </span>
        )}
        {isDirty && <span style={{ color: '#6A4A1A' }}>unsaved</span>}
      </span>

      {/* Right — version */}
      <span style={{ minWidth: 140, textAlign: 'right' }}>
        {version != null ? `CANShift Studio v${version}` : 'CANShift Studio'}
      </span>
    </footer>
  )
}

// StatusBar.tsx — Bottom status bar

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDeviceStore } from '../../stores/device.store'
import { useDashboardStore } from '../../stores/dashboard.store'
import { useCanHealthStore } from '../../stores/canHealth.store'
import { useAppVersionStore } from '../../stores/appVersion.store'

const HEALTH_STALE_MS = 6_000

export default function StatusBar() {
  const connected = useDeviceStore((s) => s.connected)
  const portPath = useDeviceStore((s) => s.portPath)
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion)
  const firmwareCheckKind = useDeviceStore((s) => s.firmwareCheck.kind)
  const isDirty = useDashboardStore((s) => s.isDirty)
  const canFps = useCanHealthStore((s) => s.fps)
  const canErrors = useCanHealthStore((s) => s.errors)
  const canUpdatedAt = useCanHealthStore((s) => s.updatedAt)
  const navigate = useNavigate()

  const studioVersion = useAppVersionStore((s) => s.version)
  const loadVersion = useAppVersionStore((s) => s.loadVersion)

  useEffect(() => {
    void loadVersion()
  }, [loadVersion])

  const canFresh =
    canFps !== null && canUpdatedAt !== null && Date.now() - canUpdatedAt < HEALTH_STALE_MS
  const canFpsStr = canFresh ? `${canFps.toFixed(1)}/s` : null

  const showUpdateHint =
    firmwareCheckKind === 'update_available' || firmwareCheckKind === 'no_firmware'

  const goToUpdate = (): void => {
    navigate('/update')
  }

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
      {/* Left — connection · firmware version (button → /update) */}
      <button
        onClick={goToUpdate}
        title={
          showUpdateHint
            ? 'Firmware update available — open the update panel'
            : 'Open the firmware update panel'
        }
        style={{
          minWidth: 200,
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          padding: 0,
          fontSize: 10,
          letterSpacing: '0.03em',
          fontFamily: 'inherit',
          cursor: 'pointer',
          color: '#3A3A3A',
        }}
      >
        {connected ? (
          <>
            <span style={{ color: '#3D7A4A' }}>● {portPath ?? 'connected'}</span>
            <span style={{ color: '#2A2A2A', margin: '0 6px' }}>·</span>
            <span style={{ color: showUpdateHint ? '#CC8844' : '#555555' }}>
              {firmwareVersion ? `v${firmwareVersion}` : '—'}
              {showUpdateHint ? ' (update)' : ''}
            </span>
          </>
        ) : (
          <span style={{ color: '#3A3A3A' }}>—</span>
        )}
      </button>

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

      {/* Right — studio version */}
      <span style={{ minWidth: 140, textAlign: 'right' }}>
        {studioVersion != null ? `CANShift Studio v${studioVersion}` : 'CANShift Studio'}
      </span>
    </footer>
  )
}

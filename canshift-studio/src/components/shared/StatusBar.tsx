// StatusBar.tsx — Bottom status bar

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDeviceStore } from '../../stores/device.store'
import { useDashboardStore } from '../../stores/dashboard.store'
import { useCanHealthStore } from '../../stores/canHealth.store'
import { useAppVersionStore } from '../../stores/appVersion.store'

const HEALTH_STALE_MS = 6_000

// Chrome shades not yet mapped to core tokens. Hoisted so the planned token
// promotion (audit S-H-5, umbrella #1015) is a one-line swap per shade.
const FOOTER_BG = '#080808' // MIRROR: darker than --bg (#121212)
const FOOTER_BORDER = '#181818' // MIRROR: between --bg and --surface
const TEXT_DISABLED = '#3A3A3A' // MIRROR: deeper than --text-muted
const TEXT_FIRMWARE = '#555555' // MIRROR
const DIVIDER_DOT = '#2A2A2A' // MIRROR: ≈ --surface-2 (#292929)
const STATUS_GREEN_DIM = '#3D7A4A' // MIRROR: darker variant of --success
const STATUS_ORANGE_DIM = '#CC8844' // MIRROR: darker variant of --warning
const CAN_OK = '#3A4A3A' // MIRROR
const CAN_ERR = '#7A4A20' // MIRROR
const UNSAVED = '#6A4A1A' // MIRROR

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
        background: FOOTER_BG,
        borderTop: `1px solid ${FOOTER_BORDER}`,
        padding: '0 12px',
        fontSize: 10,
        color: TEXT_DISABLED,
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
          color: TEXT_DISABLED,
        }}
      >
        {connected ? (
          <>
            <span style={{ color: STATUS_GREEN_DIM }}>● {portPath ?? 'connected'}</span>
            <span style={{ color: DIVIDER_DOT, margin: '0 6px' }}>·</span>
            <span style={{ color: showUpdateHint ? STATUS_ORANGE_DIM : TEXT_FIRMWARE }}>
              {firmwareVersion ? `v${firmwareVersion}` : '—'}
              {showUpdateHint ? ' (update)' : ''}
            </span>
          </>
        ) : (
          <span style={{ color: TEXT_DISABLED }}>—</span>
        )}
      </button>

      {/* Center — CAN health + dirty flag */}
      <span style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        {canFpsStr !== null && (
          <span style={{ color: canErrors ? CAN_ERR : CAN_OK }}>
            CAN {canFpsStr}
            {canErrors ? ` · ${String(canErrors)} err` : ''}
          </span>
        )}
        {isDirty && <span style={{ color: UNSAVED }}>unsaved</span>}
      </span>

      {/* Right — studio version */}
      <span style={{ minWidth: 140, textAlign: 'right' }}>
        {studioVersion != null ? `CANShift Studio v${studioVersion}` : 'CANShift Studio'}
      </span>
    </footer>
  )
}

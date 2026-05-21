// VersionMismatchBanner.tsx — Warns when the studio and firmware semvers
// disagree on major or minor (patch is allowed to drift). The pair lives in
// lockstep through schema migrations, IPC commands, and binary asset formats,
// so a wide gap is the most common cause of "weird" runtime issues.

import { useEffect, useState } from 'react'
import { useDeviceStore } from '../../stores/device.store'
import { useAppVersionStore } from '../../stores/appVersion.store'

interface Semver {
  major: number
  minor: number
  patch: number
}

function parseSemver(s: string | null | undefined): Semver | null {
  if (!s) return null
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(s)
  if (!m) return null
  return {
    major: parseInt(m[1] ?? '0', 10),
    minor: parseInt(m[2] ?? '0', 10),
    patch: parseInt(m[3] ?? '0', 10),
  }
}

function isMismatch(studio: Semver, firmware: Semver): boolean {
  return studio.major !== firmware.major || studio.minor !== firmware.minor
}

export default function VersionMismatchBanner() {
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion)
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const studioVersion = useAppVersionStore((s) => s.version)
  const loadVersion = useAppVersionStore((s) => s.loadVersion)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    void loadVersion()
  }, [loadVersion])

  // Reset the dismissed state whenever the firmware version changes — a fresh
  // device should resurface the warning rather than stay silent.
  useEffect(() => {
    setDismissed(false)
  }, [firmwareVersion])

  if (!connected || simulationMode || dismissed) return null
  const studio = parseSemver(studioVersion)
  const firmware = parseSemver(firmwareVersion)
  if (!studio || !firmware) return null
  if (!isMismatch(studio, firmware)) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 32,
        left: 16,
        zIndex: 9998,
        background: '#1A1208',
        border: '1px solid #AA6622',
        borderRadius: 6,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 12,
        color: '#DDAA66',
        maxWidth: 460,
        boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
      }}
    >
      <span>
        Version mismatch — studio <b>v{studioVersion}</b> vs firmware <b>v{firmwareVersion}</b>.
        Schema or IPC drift likely; update either side before pushing config.
      </span>
      <button
        onClick={() => {
          setDismissed(true)
        }}
        style={{
          padding: '3px 8px',
          background: 'transparent',
          border: '1px solid #553311',
          borderRadius: 3,
          color: '#AA7733',
          fontSize: 11,
          cursor: 'pointer',
        }}
        title="Hide for this session"
      >
        Dismiss
      </button>
    </div>
  )
}

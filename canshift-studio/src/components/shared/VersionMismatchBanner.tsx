// VersionMismatchBanner.tsx — Warns when the studio and firmware semvers
// disagree on major or minor (patch is allowed to drift). The pair lives in
// lockstep through schema migrations, IPC commands, and binary asset formats,
// so a wide gap is the most common cause of "weird" runtime issues.

import { useEffect, useState } from 'react'
import { useDeviceStore } from '../../stores/device.store'
import { useAppVersionStore } from '../../stores/appVersion.store'

// Warning chrome palette — `--warning` (#FF8800) is too bright for a sustained
// banner background. Hoisted as MIRROR consts per audit S-H-5 (umbrella #1015)
// so the future token promotion is a single-line swap.
const WARN_BG = '#1A1208' // MIRROR: deep amber banner background
const WARN_BORDER = '#AA6622' // MIRROR: dim amber border
const WARN_TEXT = '#DDAA66' // MIRROR: amber body text
const WARN_BTN_BORDER = '#553311' // MIRROR: darker amber for dismiss button border
const WARN_BTN_TEXT = '#AA7733' // MIRROR: dismiss button label
// `--scrim` is the canonical token since #1097 — 0.6 alpha matches the original rgba.
const BANNER_SHADOW = '0 4px 16px hsl(var(--scrim) / 0.6)'

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
        background: WARN_BG,
        border: `1px solid ${WARN_BORDER}`,
        borderRadius: 6,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 12,
        color: WARN_TEXT,
        maxWidth: 460,
        boxShadow: BANNER_SHADOW,
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
          border: `1px solid ${WARN_BTN_BORDER}`,
          borderRadius: 3,
          color: WARN_BTN_TEXT,
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

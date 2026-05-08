// SdPrepPanel.tsx — Post-flash SD card preparation panel.
//
// Extracted from the deleted FirmwareDialog so the SD-prep step survives the
// firmware-flow redesign. Mounted inside UpdateRoute below the flash actions:
// after a successful flash the user can push assets over USB (no eject) or
// pick a mounted SD volume.

import { useCallback, useEffect, useState } from 'react'
import { useDeviceStore } from '../../stores/device.store'
import { sdIpc } from '../../services/ipc.service'
import type { SdVolume } from '../../services/ipc.service'

type SdState = 'idle' | 'copying' | 'done' | 'error'

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  color: '#666666',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 8,
}

interface SdPrepPanelProps {
  /**
   * When true, the panel renders. UpdateRoute toggles this on after a flash
   * completes (or any time the user wants to repopulate an SD card).
   */
  expanded: boolean
  onClose?: () => void
}

export default function SdPrepPanel({ expanded, onClose }: SdPrepPanelProps) {
  const connected = useDeviceStore((s) => s.connected)

  const [sdVolumes, setSdVolumes] = useState<SdVolume[]>([])
  const [selectedVolume, setSelectedVolume] = useState<string>('')
  const [loadingVolumes, setLoadingVolumes] = useState(false)
  const [sdState, setSdState] = useState<SdState>('idle')
  const [sdError, setSdError] = useState<string>('')
  const [sdCopied, setSdCopied] = useState<{ copied: number; skipped: number } | null>(null)
  const [picking, setPicking] = useState(false)

  const scanVolumes = useCallback(() => {
    setLoadingVolumes(true)
    sdIpc
      .listVolumes()
      .then((vols) => {
        setSdVolumes(vols)
        if (vols.length === 1 && vols[0]) setSelectedVolume(vols[0].path)
        else setSelectedVolume('')
      })
      .catch(() => {
        setSdVolumes([])
      })
      .finally(() => {
        setLoadingVolumes(false)
      })
  }, [])

  useEffect(() => {
    if (!expanded) {
      setSdState('idle')
      setSdError('')
      setSdCopied(null)
      setPicking(false)
    }
  }, [expanded])

  const handlePushOverUsb = useCallback(async () => {
    setSdState('copying')
    setSdError('')
    setSdCopied(null)
    const result = await sdIpc.pushOverUsb()
    if (result.success) {
      setSdCopied({ copied: result.copied.length, skipped: result.skipped.length })
      setSdState('done')
    } else {
      setSdError(result.error ?? 'Push over USB failed')
      setSdState('error')
    }
  }, [])

  const handleConfirmSdVolume = useCallback(async () => {
    if (!selectedVolume) return
    setSdState('copying')
    setSdError('')
    setSdCopied(null)
    const result = await sdIpc.prepare(selectedVolume)
    if (result.success) {
      setSdCopied({ copied: result.copied.length, skipped: result.skipped.length })
      setSdState('done')
    } else {
      setSdError(result.error ?? 'Failed to copy SD contents')
      setSdState('error')
    }
  }, [selectedVolume])

  const handleStartPickVolume = useCallback(() => {
    setPicking(true)
    scanVolumes()
  }, [scanVolumes])

  const handleRetry = useCallback(() => {
    setSdState('idle')
    setSdError('')
    setSdCopied(null)
  }, [])

  if (!expanded) return null

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 480,
        background: '#161616',
        border: '1px solid #222222',
        borderRadius: 6,
        padding: '14px 16px',
      }}
    >
      <div style={sectionLabel}>SD card</div>

      {sdState === 'copying' ? (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 13, color: '#CCCCCC', marginBottom: 4 }}>Copying to SD card…</div>
          <div style={{ fontSize: 11, color: '#555555' }}>Do not eject the card</div>
        </div>
      ) : sdState === 'done' ? (
        <div style={{ textAlign: 'center', padding: '4px 0' }}>
          <div style={{ fontSize: 22, color: '#3DB86B', marginBottom: 4 }}>✓</div>
          <div style={{ fontSize: 13, color: '#3DB86B', fontWeight: 600, marginBottom: 4 }}>
            SD card ready
          </div>
          {sdCopied && (
            <div style={{ fontSize: 11, color: '#666666', marginBottom: 12 }}>
              {sdCopied.copied} file{sdCopied.copied !== 1 ? 's' : ''} copied
              {sdCopied.skipped > 0
                ? `, ${String(sdCopied.skipped)} skipped (user data preserved)`
                : ''}
            </div>
          )}
          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: '6px 16px',
                borderRadius: 4,
                fontSize: 11,
                cursor: 'pointer',
                border: '1px solid #333333',
                background: 'transparent',
                color: '#888888',
              }}
            >
              Close
            </button>
          )}
        </div>
      ) : sdState === 'error' ? (
        <div style={{ padding: '4px 0' }}>
          <div style={{ fontSize: 13, color: '#CC4444', fontWeight: 600, marginBottom: 6 }}>
            SD prep failed
          </div>
          <div
            style={{
              fontSize: 11,
              color: '#888888',
              background: '#111111',
              border: '1px solid #2A2A2A',
              borderRadius: 4,
              padding: '8px 10px',
              marginBottom: 10,
              wordBreak: 'break-word',
            }}
          >
            {sdError}
          </div>
          <button
            onClick={handleRetry}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              fontSize: 11,
              cursor: 'pointer',
              border: '1px solid #333333',
              background: '#222222',
              color: '#CCCCCC',
            }}
          >
            Try again
          </button>
        </div>
      ) : !picking ? (
        <>
          <div style={{ fontSize: 11, color: '#888888', marginBottom: 12, lineHeight: 1.5 }}>
            Copies fonts, assets and default configs — required for the display to work.
            {connected ? ' Pick the USB option if your SD card is in the device.' : ''}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {connected && (
              <button
                onClick={() => {
                  void handlePushOverUsb()
                }}
                style={{
                  padding: '7px 0',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: '#CC3333',
                  color: '#FFFFFF',
                }}
              >
                Push over USB (no eject)
              </button>
            )}
            <button
              onClick={handleStartPickVolume}
              style={{
                padding: '7px 0',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: connected ? 400 : 600,
                cursor: 'pointer',
                border: connected ? '1px solid #333333' : 'none',
                background: connected ? 'transparent' : '#CC3333',
                color: connected ? '#AAAAAA' : '#FFFFFF',
              }}
            >
              {connected ? 'Use a mounted SD card instead…' : 'Prepare SD card'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 11, color: '#888888', marginBottom: 8 }}>Select SD volume</div>
          {loadingVolumes ? (
            <div style={{ fontSize: 11, color: '#666666', marginBottom: 10 }}>
              Scanning volumes…
            </div>
          ) : sdVolumes.length === 0 ? (
            <div style={{ fontSize: 11, color: '#666666', marginBottom: 10 }}>
              No external volumes found — insert the SD card then{' '}
              <span
                style={{ color: '#CC4444', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={scanVolumes}
              >
                refresh
              </span>
            </div>
          ) : (
            <select
              value={selectedVolume}
              onChange={(e) => {
                setSelectedVolume(e.target.value)
              }}
              style={{
                width: '100%',
                padding: '6px 8px',
                borderRadius: 4,
                border: '1px solid #333333',
                background: '#111111',
                color: '#CCCCCC',
                fontSize: 12,
                marginBottom: 10,
              }}
            >
              <option value="">— choose a volume —</option>
              {sdVolumes.map((v) => (
                <option key={v.path} value={v.path}>
                  {v.label}
                </option>
              ))}
            </select>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                void handleConfirmSdVolume()
              }}
              disabled={!selectedVolume}
              style={{
                flex: 1,
                padding: '7px 0',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                cursor: selectedVolume ? 'pointer' : 'not-allowed',
                border: 'none',
                background: selectedVolume ? '#CC3333' : '#332222',
                color: selectedVolume ? '#FFFFFF' : '#666666',
              }}
            >
              Copy to SD
            </button>
            <button
              onClick={() => {
                setPicking(false)
              }}
              style={{
                padding: '7px 16px',
                borderRadius: 4,
                fontSize: 12,
                cursor: 'pointer',
                border: '1px solid #333333',
                background: 'transparent',
                color: '#888888',
              }}
            >
              Back
            </button>
          </div>
        </>
      )}
    </div>
  )
}

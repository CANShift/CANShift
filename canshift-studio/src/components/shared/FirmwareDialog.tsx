// FirmwareDialog.tsx — Modal for initial firmware flash and firmware updates.
//
// Flow: select version → (optional) prepare SD card → flash firmware.
// SD step copies sd_contents/ to the selected volume before flashing.

import { useState, useEffect, useCallback, useRef } from 'react'
import { useDeviceStore } from '../../stores/device.store'
import { firmwareIpc, sdIpc } from '../../services/ipc.service'
import { useFirmwareFlash } from '../../hooks/useFirmwareFlash'
import type { FirmwareRelease, SdVolume } from '../../services/ipc.service'

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 2000,
  background: 'rgba(0,0,0,0.75)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const dialog: React.CSSProperties = {
  width: 460,
  maxHeight: '80vh',
  background: '#1A1A1A',
  border: '1px solid #2A2A2A',
  borderRadius: 10,
  boxShadow: '0 24px 64px #00000099',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  color: '#555555',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 6,
}

// ---------------------------------------------------------------------------
// Dialog phase — drives which panel is shown
// ---------------------------------------------------------------------------

type DialogPhase = 'setup' | 'sd-copying' | 'sd-error' | 'flash'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FirmwareDialog() {
  const firmwareDialog = useDeviceStore((s) => s.firmwareDialog)
  const setFirmwareDialog = useDeviceStore((s) => s.setFirmwareDialog)
  const portPath = useDeviceStore((s) => s.portPath)
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion)

  const [channel, setChannel] = useState<'stable' | 'beta'>('stable')
  const [releases, setReleases] = useState<FirmwareRelease[]>([])
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // SD state
  const [sdVolumes, setSdVolumes] = useState<SdVolume[]>([])
  const [selectedVolume, setSelectedVolume] = useState<string>('')
  const [loadingVolumes, setLoadingVolumes] = useState(false)
  const [sdCopied, setSdCopied] = useState<{ copied: number; skipped: number } | null>(null)
  const [sdError, setSdError] = useState<string>('')

  // Dialog phase
  const [dialogPhase, setDialogPhase] = useState<DialogPhase>('setup')

  const { state, phase, progress, logs, error, flash, reset } = useFirmwareFlash()

  const { visible, mode } = firmwareDialog

  const scanVolumes = useCallback(() => {
    setLoadingVolumes(true)
    sdIpc
      .listVolumes()
      .then((vols) => {
        setSdVolumes(vols)
        // Auto-select when exactly one external volume is detected
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

  // On open: reset state, load releases, scan SD volumes
  useEffect(() => {
    if (!visible) return
    setDialogPhase('setup')
    setSdCopied(null)
    setSdError('')
    reset()
    scanVolumes()
  }, [visible]) // intentional: scanVolumes and reset are stable refs, visible is the trigger

  // Reload releases when channel changes
  useEffect(() => {
    if (!visible) return
    setLoading(true)
    setReleases([])
    setSelectedTag('')
    firmwareIpc
      .listReleases(channel)
      .then((list) => {
        setReleases(list)
        if (list.length > 0 && list[0]) setSelectedTag(list[0].tag)
      })
      .catch(() => {
        /* error shown inline */
      })
      .finally(() => {
        setLoading(false)
      })
  }, [visible, channel])

  const selectedRelease: FirmwareRelease | undefined = releases.find((r) => r.tag === selectedTag)

  const isFlashing = state === 'downloading' || state === 'connecting' || state === 'flashing'
  const isBusy = dialogPhase === 'sd-copying' || isFlashing

  const handleReset = useCallback(() => {
    setDialogPhase('setup')
    setSdError('')
    setSdCopied(null)
    reset()
  }, [reset])

  const handleClose = useCallback(() => {
    if (isBusy) return
    setFirmwareDialog({ visible: false, mode: null })
    handleReset()
  }, [isBusy, setFirmwareDialog, handleReset])

  const handleFlash = useCallback(async () => {
    if (!selectedRelease?.downloadUrl || !portPath) return

    // Step 1: copy SD contents if a volume is selected
    if (selectedVolume) {
      setDialogPhase('sd-copying')
      const result = await sdIpc.prepare(selectedVolume)
      if (!result.success) {
        setSdError(result.error ?? 'Failed to copy SD contents')
        setDialogPhase('sd-error')
        return
      }
      setSdCopied({ copied: result.copied.length, skipped: result.skipped.length })
    }

    // Step 2: flash firmware
    setDialogPhase('flash')
    await flash({ type: 'url', url: selectedRelease.downloadUrl }, portPath, selectedRelease.tag)
  }, [selectedRelease, portPath, flash, selectedVolume])

  if (!visible) return null

  // Body content varies by dialog phase and flash state
  const bodyContent = (() => {
    if (dialogPhase === 'sd-copying') return <SdCopyingPanel />

    if (dialogPhase === 'sd-error')
      return <ErrorPanel message={sdError} onRetry={handleReset} label="SD copy failed" />

    if (dialogPhase === 'flash') {
      if (state === 'done') return <DonePanel onClose={handleClose} sdCopied={sdCopied} />
      if (state === 'error')
        return <ErrorPanel message={error ?? 'Flash failed'} onRetry={handleReset} />
      if (isFlashing) return <ProgressPanel phase={phase} progress={progress} logs={logs} />
    }

    // setup
    return (
      <>
        {/* Channel picker */}
        <div style={{ marginBottom: 16 }}>
          <div style={sectionLabel}>Release channel</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['stable', 'beta'] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => {
                  setChannel(ch)
                }}
                style={{
                  padding: '5px 14px',
                  borderRadius: 4,
                  fontSize: 12,
                  cursor: 'pointer',
                  border: channel === ch ? '1px solid #CC3333' : '1px solid #333333',
                  background: channel === ch ? '#CC3333' : 'transparent',
                  color: channel === ch ? '#FFFFFF' : '#888888',
                }}
              >
                {ch === 'stable' ? 'Stable' : 'Beta'}
              </button>
            ))}
          </div>
        </div>

        {/* Version list */}
        <div style={{ marginBottom: 16 }}>
          <div style={sectionLabel}>Version</div>
          {loading ? (
            <div style={{ fontSize: 12, color: '#555555', padding: '8px 0' }}>
              Loading releases…
            </div>
          ) : releases.length === 0 ? (
            <div style={{ fontSize: 12, color: '#555555', padding: '8px 0' }}>
              No releases found for this channel
            </div>
          ) : (
            <div
              style={{
                border: '1px solid #2A2A2A',
                borderRadius: 6,
                overflow: 'hidden',
                maxHeight: 160,
                overflowY: 'auto',
              }}
            >
              {releases.map((r) => (
                <div
                  key={r.tag}
                  onClick={() => {
                    setSelectedTag(r.tag)
                  }}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #222222',
                    background: selectedTag === r.tag ? '#CC333322' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: 13, color: '#CCCCCC', fontWeight: 500 }}>
                    v{r.version}
                    {!r.downloadUrl && (
                      <span style={{ fontSize: 10, color: '#554444', marginLeft: 6 }}>
                        (no binary)
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: 10, color: '#555555' }}>
                    {new Date(r.publishedAt).toLocaleDateString()}
                    {r.prerelease && (
                      <span
                        style={{
                          marginLeft: 6,
                          color: '#CC8800',
                          border: '1px solid #CC880044',
                          borderRadius: 3,
                          padding: '1px 4px',
                        }}
                      >
                        beta
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Release notes */}
        {selectedRelease?.notes && (
          <div style={{ marginBottom: 16 }}>
            <div style={sectionLabel}>Release notes</div>
            <div
              style={{
                fontSize: 11,
                color: '#666666',
                lineHeight: 1.6,
                maxHeight: 80,
                overflowY: 'auto',
                background: '#111111',
                border: '1px solid #222222',
                borderRadius: 4,
                padding: '8px 10px',
                whiteSpace: 'pre-wrap',
              }}
            >
              {selectedRelease.notes}
            </div>
          </div>
        )}

        {/* SD card section */}
        <div style={{ marginBottom: 4 }}>
          <div style={sectionLabel}>SD card</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {loadingVolumes ? (
              <span style={{ fontSize: 12, color: '#555555', flex: 1 }}>Detecting volumes…</span>
            ) : sdVolumes.length === 0 ? (
              <span style={{ fontSize: 12, color: '#555555', flex: 1 }}>
                No SD card detected — insert SD into your computer
              </span>
            ) : (
              <select
                value={selectedVolume}
                onChange={(e) => {
                  setSelectedVolume(e.target.value)
                }}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  borderRadius: 4,
                  fontSize: 12,
                  background: '#111111',
                  border: '1px solid #333333',
                  color: selectedVolume ? '#CCCCCC' : '#666666',
                  cursor: 'pointer',
                }}
              >
                <option value="">Skip SD prep</option>
                {sdVolumes.map((v) => (
                  <option key={v.path} value={v.path}>
                    {v.label}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={scanVolumes}
              disabled={loadingVolumes}
              title="Refresh volumes"
              style={{
                padding: '5px 8px',
                borderRadius: 4,
                fontSize: 12,
                cursor: loadingVolumes ? 'default' : 'pointer',
                border: '1px solid #333333',
                background: 'transparent',
                color: '#666666',
              }}
            >
              ↺
            </button>
          </div>
          {selectedVolume && (
            <div style={{ fontSize: 10, color: '#444444', marginTop: 4 }}>
              Fonts overwrite. Config files are skipped if already present.
            </div>
          )}
        </div>
      </>
    )
  })()

  return (
    <div style={overlay} onClick={handleClose}>
      <div
        style={dialog}
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #222222',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF', marginBottom: 2 }}>
              {mode === 'flash' ? 'Flash Firmware' : 'Firmware Update Available'}
            </div>
            <div style={{ fontSize: 11, color: '#555555' }}>
              {mode === 'flash'
                ? 'No CANShift firmware detected on this device'
                : `Device firmware: v${firmwareVersion ?? '?'}`}
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isBusy}
            style={{
              background: 'none',
              border: 'none',
              color: '#555555',
              cursor: isBusy ? 'not-allowed' : 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>{bodyContent}</div>

        {/* Footer — only shown in setup phase */}
        {dialogPhase === 'setup' && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid #222222',
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
            }}
          >
            <button
              onClick={handleClose}
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
              {mode === 'update' ? 'Skip' : 'Cancel'}
            </button>
            <button
              onClick={() => {
                void handleFlash()
              }}
              disabled={!selectedRelease?.downloadUrl || !portPath || loading}
              style={{
                padding: '7px 20px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                cursor:
                  selectedRelease?.downloadUrl && portPath && !loading ? 'pointer' : 'not-allowed',
                border: 'none',
                background:
                  selectedRelease?.downloadUrl && portPath && !loading ? '#CC3333' : '#332222',
                color: selectedRelease?.downloadUrl && portPath && !loading ? '#FFFFFF' : '#666666',
              }}
            >
              {selectedVolume
                ? mode === 'flash'
                  ? 'Flash SD + Firmware'
                  : 'Update SD + Firmware'
                : mode === 'flash'
                  ? 'Flash Firmware'
                  : 'Update'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-panels
// ---------------------------------------------------------------------------

function SdCopyingPanel() {
  return (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <div style={{ fontSize: 13, color: '#CCCCCC', marginBottom: 8 }}>Copying to SD card…</div>
      <div style={{ fontSize: 11, color: '#555555' }}>This may take a few seconds</div>
    </div>
  )
}

function ProgressPanel({
  phase,
  progress,
  logs,
}: {
  phase: 'downloading' | 'connecting' | 'flashing'
  progress: number
  logs: string[]
}) {
  const label =
    phase === 'downloading'
      ? 'Downloading firmware…'
      : phase === 'connecting'
        ? 'Connecting to device…'
        : 'Flashing…'

  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontSize: 13, color: '#CCCCCC', marginBottom: 12 }}>{label}</div>
      <div
        style={{
          height: 6,
          background: '#111111',
          borderRadius: 3,
          overflow: 'hidden',
          marginBottom: 8,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${String(progress)}%`,
            background: '#CC3333',
            borderRadius: 3,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <div style={{ fontSize: 11, color: '#555555', textAlign: 'right', marginBottom: 12 }}>
        {progress}%
      </div>
      {logs.length > 0 && (
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 10,
            color: '#666666',
            background: '#0D0D0D',
            border: '1px solid #1E1E1E',
            borderRadius: 4,
            padding: '8px 10px',
            maxHeight: 140,
            overflowY: 'auto',
            lineHeight: 1.6,
          }}
        >
          {logs.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  )
}

function DonePanel({
  onClose,
  sdCopied,
}: {
  onClose: () => void
  sdCopied: { copied: number; skipped: number } | null
}) {
  return (
    <div style={{ textAlign: 'center', padding: '16px 0' }}>
      <div style={{ fontSize: 28, marginBottom: 12 }}>✓</div>
      <div style={{ fontSize: 14, color: '#44CC44', fontWeight: 600, marginBottom: 6 }}>
        Flash complete
      </div>
      {sdCopied && (
        <div style={{ fontSize: 11, color: '#555555', marginBottom: 4 }}>
          SD: {sdCopied.copied} file{sdCopied.copied !== 1 ? 's' : ''} copied
          {sdCopied.skipped > 0 ? `, ${String(sdCopied.skipped)} skipped` : ''}
        </div>
      )}
      <div style={{ fontSize: 12, color: '#555555', marginBottom: 20 }}>
        Device is rebooting — reconnecting automatically…
      </div>
      <button
        onClick={onClose}
        style={{
          padding: '7px 20px',
          borderRadius: 4,
          fontSize: 12,
          cursor: 'pointer',
          border: '1px solid #333333',
          background: 'transparent',
          color: '#888888',
        }}
      >
        Close
      </button>
    </div>
  )
}

function ErrorPanel({
  message,
  onRetry,
  label = 'Flash failed',
}: {
  message: string
  onRetry: () => void
  label?: string
}) {
  return (
    <div style={{ textAlign: 'center', padding: '16px 0' }}>
      <div style={{ fontSize: 14, color: '#CC3333', fontWeight: 600, marginBottom: 8 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 11,
          color: '#666666',
          background: '#111111',
          border: '1px solid #222222',
          borderRadius: 4,
          padding: '8px 12px',
          marginBottom: 16,
          textAlign: 'left',
          wordBreak: 'break-word',
        }}
      >
        {message}
      </div>
      <button
        onClick={onRetry}
        style={{
          padding: '7px 20px',
          borderRadius: 4,
          fontSize: 12,
          cursor: 'pointer',
          border: 'none',
          background: '#333333',
          color: '#CCCCCC',
        }}
      >
        Try again
      </button>
    </div>
  )
}

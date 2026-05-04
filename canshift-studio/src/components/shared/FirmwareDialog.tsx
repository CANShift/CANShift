// FirmwareDialog.tsx — Modal for initial firmware flash and firmware updates.
//
// Shown automatically when:
//   - Device connects but doesn't respond to version probe ('flash' mode)
//   - Device firmware is outdated compared to latest GitHub release ('update' mode)

import { useState, useEffect, useCallback, useRef } from 'react'
import { useDeviceStore } from '../../stores/device.store'
import { firmwareIpc } from '../../services/ipc.service'
import { useFirmwareFlash } from '../../hooks/useFirmwareFlash'
import type { FirmwareRelease } from '../../services/ipc.service'

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

  const { state, phase, progress, logs, error, flash, reset } = useFirmwareFlash()

  const { visible, mode } = firmwareDialog

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

  const handleClose = useCallback(() => {
    if (isFlashing) return
    setFirmwareDialog({ visible: false, mode: null })
    reset()
  }, [isFlashing, setFirmwareDialog, reset])

  const handleFlash = useCallback(async () => {
    if (!selectedRelease?.downloadUrl || !portPath) return
    await flash({ type: 'url', url: selectedRelease.downloadUrl }, portPath, selectedRelease.tag)
  }, [selectedRelease, portPath, flash])

  if (!visible) return null

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
            disabled={isFlashing}
            style={{
              background: 'none',
              border: 'none',
              color: '#555555',
              cursor: isFlashing ? 'not-allowed' : 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {state === 'done' ? (
            <DonePanel onClose={handleClose} />
          ) : state === 'error' ? (
            <ErrorPanel message={error ?? 'Flash failed'} onRetry={reset} />
          ) : isFlashing ? (
            <ProgressPanel phase={phase} progress={progress} logs={logs} />
          ) : (
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
            </>
          )}
        </div>

        {/* Footer */}
        {!isFlashing && state !== 'done' && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid #222222',
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
            }}
          >
            {state !== 'error' && (
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
            )}
            {state !== 'error' && (
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
                    selectedRelease?.downloadUrl && portPath && !loading
                      ? 'pointer'
                      : 'not-allowed',
                  border: 'none',
                  background:
                    selectedRelease?.downloadUrl && portPath && !loading ? '#CC3333' : '#332222',
                  color:
                    selectedRelease?.downloadUrl && portPath && !loading ? '#FFFFFF' : '#666666',
                }}
              >
                {mode === 'flash' ? 'Flash Firmware' : 'Update'}
              </button>
            )}
            {state === 'error' && (
              <button
                onClick={reset}
                style={{
                  padding: '7px 16px',
                  borderRadius: 4,
                  fontSize: 12,
                  cursor: 'pointer',
                  border: '1px solid #333333',
                  background: '#222222',
                  color: '#CCCCCC',
                }}
              >
                Try again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-panels
// ---------------------------------------------------------------------------

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

function DonePanel({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '16px 0' }}>
      <div style={{ fontSize: 28, marginBottom: 12 }}>✓</div>
      <div style={{ fontSize: 14, color: '#44CC44', fontWeight: 600, marginBottom: 6 }}>
        Flash complete
      </div>
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

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '16px 0' }}>
      <div style={{ fontSize: 14, color: '#CC3333', fontWeight: 600, marginBottom: 8 }}>
        Flash failed
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

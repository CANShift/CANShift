// FirmwareDialog.tsx — Modal for initial firmware flash and firmware updates.
//
// Flow: select version → (optional) prepare SD card → flash firmware.

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

const dialogBox: React.CSSProperties = {
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DialogPhase = 'setup' | 'sd-copying' | 'sd-error' | 'flash'

interface SdCopyResult {
  copied: number
  skipped: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flashButtonLabel(mode: 'flash' | 'update' | null, withSd: boolean): string {
  if (mode === 'update') return withSd ? 'Update SD + Firmware' : 'Update'
  return withSd ? 'Flash SD + Firmware' : 'Flash Firmware'
}

function autoSelectVolume(volumes: SdVolume[]): string {
  return volumes.length === 1 && volumes[0] ? volumes[0].path : ''
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function FirmwareDialog() {
  const firmwareDialog = useDeviceStore((s) => s.firmwareDialog)
  const setFirmwareDialog = useDeviceStore((s) => s.setFirmwareDialog)
  const portPath = useDeviceStore((s) => s.portPath)
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion)

  const [channel, setChannel] = useState<'stable' | 'beta'>('stable')
  const [releases, setReleases] = useState<FirmwareRelease[]>([])
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [loadingReleases, setLoadingReleases] = useState(false)

  const [sdVolumes, setSdVolumes] = useState<SdVolume[]>([])
  const [selectedVolume, setSelectedVolume] = useState<string>('')
  const [loadingVolumes, setLoadingVolumes] = useState(false)

  const [dialogPhase, setDialogPhase] = useState<DialogPhase>('setup')
  const [sdCopyResult, setSdCopyResult] = useState<SdCopyResult | null>(null)
  const [sdError, setSdError] = useState<string>('')

  const { state, phase, progress, logs, error, flash, reset } = useFirmwareFlash()

  const { visible, mode } = firmwareDialog

  const isFlashing = state === 'downloading' || state === 'connecting' || state === 'flashing'
  const isBusy = dialogPhase === 'sd-copying' || isFlashing

  const selectedRelease = releases.find((r) => r.tag === selectedTag)
  const canFlash = Boolean(selectedRelease?.downloadUrl && portPath && !loadingReleases)

  const scanVolumes = useCallback(() => {
    setLoadingVolumes(true)
    sdIpc
      .listVolumes()
      .then((vols) => {
        setSdVolumes(vols)
        setSelectedVolume(autoSelectVolume(vols))
      })
      .catch(() => {
        setSdVolumes([])
      })
      .finally(() => {
        setLoadingVolumes(false)
      })
  }, [])

  useEffect(() => {
    if (!visible) return
    setDialogPhase('setup')
    setSdCopyResult(null)
    setSdError('')
    reset()
    scanVolumes()
  }, [visible]) // intentional: reset and scanVolumes are stable; visible is the only trigger

  useEffect(() => {
    if (!visible) return
    setLoadingReleases(true)
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
        setLoadingReleases(false)
      })
  }, [visible, channel])

  const copyToSelectedVolume = useCallback(async (): Promise<boolean> => {
    setDialogPhase('sd-copying')
    const result = await sdIpc.prepare(selectedVolume)
    if (!result.success) {
      setSdError(result.error ?? 'Failed to copy SD contents')
      setDialogPhase('sd-error')
      return false
    }
    setSdCopyResult({ copied: result.copied.length, skipped: result.skipped.length })
    return true
  }, [selectedVolume])

  const handleFlash = useCallback(async () => {
    if (!selectedRelease?.downloadUrl || !portPath) return

    if (selectedVolume) {
      const sdOk = await copyToSelectedVolume()
      if (!sdOk) return
    }

    setDialogPhase('flash')
    await flash(
      { type: 'url', url: selectedRelease.downloadUrl },
      portPath,
      selectedRelease.tag,
      selectedRelease.spiffsUrl
    )
  }, [selectedRelease, portPath, flash, selectedVolume, copyToSelectedVolume])

  const handleReset = useCallback(() => {
    setDialogPhase('setup')
    setSdError('')
    setSdCopyResult(null)
    reset()
  }, [reset])

  const handleClose = useCallback(() => {
    if (isBusy) return
    setFirmwareDialog({ visible: false, mode: null })
    handleReset()
  }, [isBusy, setFirmwareDialog, handleReset])

  if (!visible) return null

  return (
    <div style={overlay} onClick={handleClose}>
      <div
        style={dialogBox}
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <DialogHeader
          mode={mode}
          firmwareVersion={firmwareVersion}
          isBusy={isBusy}
          onClose={handleClose}
        />

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {dialogPhase === 'sd-copying' && <SdCopyingPanel />}

          {dialogPhase === 'sd-error' && (
            <ErrorPanel message={sdError} onRetry={handleReset} label="SD copy failed" />
          )}

          {dialogPhase === 'flash' && state === 'done' && (
            <DonePanel onClose={handleClose} sdCopyResult={sdCopyResult} />
          )}
          {dialogPhase === 'flash' && state === 'error' && (
            <ErrorPanel message={error ?? 'Flash failed'} onRetry={handleReset} />
          )}
          {dialogPhase === 'flash' && isFlashing && (
            <ProgressPanel phase={phase} progress={progress} logs={logs} />
          )}

          {dialogPhase === 'setup' && (
            <SetupPanel
              channel={channel}
              onChannelChange={setChannel}
              releases={releases}
              loadingReleases={loadingReleases}
              selectedTag={selectedTag}
              onTagSelect={setSelectedTag}
              sdVolumes={sdVolumes}
              loadingVolumes={loadingVolumes}
              selectedVolume={selectedVolume}
              onVolumeSelect={setSelectedVolume}
              onScanVolumes={scanVolumes}
            />
          )}
        </div>

        {dialogPhase === 'setup' && (
          <DialogFooter
            mode={mode}
            canFlash={canFlash}
            withSd={Boolean(selectedVolume)}
            onClose={handleClose}
            onFlash={() => void handleFlash()}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Layout sub-components
// ---------------------------------------------------------------------------

function DialogHeader({
  mode,
  firmwareVersion,
  isBusy,
  onClose,
}: {
  mode: 'flash' | 'update' | null
  firmwareVersion: string | null
  isBusy: boolean
  onClose: () => void
}) {
  return (
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
        onClick={onClose}
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
  )
}

function DialogFooter({
  mode,
  canFlash,
  withSd,
  onClose,
  onFlash,
}: {
  mode: 'flash' | 'update' | null
  canFlash: boolean
  withSd: boolean
  onClose: () => void
  onFlash: () => void
}) {
  return (
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
        onClick={onClose}
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
        onClick={onFlash}
        disabled={!canFlash}
        style={{
          padding: '7px 20px',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 600,
          cursor: canFlash ? 'pointer' : 'not-allowed',
          border: 'none',
          background: canFlash ? '#CC3333' : '#332222',
          color: canFlash ? '#FFFFFF' : '#666666',
        }}
      >
        {flashButtonLabel(mode, withSd)}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Setup panel — version + SD volume selection
// ---------------------------------------------------------------------------

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  color: '#555555',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 6,
}

function SetupPanel({
  channel,
  onChannelChange,
  releases,
  loadingReleases,
  selectedTag,
  onTagSelect,
  sdVolumes,
  loadingVolumes,
  selectedVolume,
  onVolumeSelect,
  onScanVolumes,
}: {
  channel: 'stable' | 'beta'
  onChannelChange: (ch: 'stable' | 'beta') => void
  releases: FirmwareRelease[]
  loadingReleases: boolean
  selectedTag: string
  onTagSelect: (tag: string) => void
  sdVolumes: SdVolume[]
  loadingVolumes: boolean
  selectedVolume: string
  onVolumeSelect: (path: string) => void
  onScanVolumes: () => void
}) {
  const selectedRelease = releases.find((r) => r.tag === selectedTag)

  return (
    <>
      <ChannelPicker channel={channel} onChange={onChannelChange} />

      <VersionList
        releases={releases}
        loading={loadingReleases}
        selectedTag={selectedTag}
        onSelect={onTagSelect}
      />

      {selectedRelease?.notes && <ReleaseNotes notes={selectedRelease.notes} />}

      <SdVolumePicker
        volumes={sdVolumes}
        loading={loadingVolumes}
        selectedVolume={selectedVolume}
        onSelect={onVolumeSelect}
        onRefresh={onScanVolumes}
      />
    </>
  )
}

function ChannelPicker({
  channel,
  onChange,
}: {
  channel: 'stable' | 'beta'
  onChange: (ch: 'stable' | 'beta') => void
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={sectionLabel}>Release channel</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {(['stable', 'beta'] as const).map((ch) => (
          <button
            key={ch}
            onClick={() => {
              onChange(ch)
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
  )
}

function VersionList({
  releases,
  loading,
  selectedTag,
  onSelect,
}: {
  releases: FirmwareRelease[]
  loading: boolean
  selectedTag: string
  onSelect: (tag: string) => void
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={sectionLabel}>Version</div>
      {loading && (
        <div style={{ fontSize: 12, color: '#555555', padding: '8px 0' }}>Loading releases…</div>
      )}
      {!loading && releases.length === 0 && (
        <div style={{ fontSize: 12, color: '#555555', padding: '8px 0' }}>
          No releases found for this channel
        </div>
      )}
      {!loading && releases.length > 0 && (
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
                onSelect(r.tag)
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
                  <span style={{ fontSize: 10, color: '#554444', marginLeft: 6 }}>(no binary)</span>
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
  )
}

function ReleaseNotes({ notes }: { notes: string }) {
  return (
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
        {notes}
      </div>
    </div>
  )
}

function SdVolumePicker({
  volumes,
  loading,
  selectedVolume,
  onSelect,
  onRefresh,
}: {
  volumes: SdVolume[]
  loading: boolean
  selectedVolume: string
  onSelect: (path: string) => void
  onRefresh: () => void
}) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={sectionLabel}>SD card</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {loading && (
          <span style={{ fontSize: 12, color: '#555555', flex: 1 }}>Detecting volumes…</span>
        )}
        {!loading && volumes.length === 0 && (
          <span style={{ fontSize: 12, color: '#555555', flex: 1 }}>
            No SD card detected — insert SD into your computer
          </span>
        )}
        {!loading && volumes.length > 0 && (
          <select
            value={selectedVolume}
            onChange={(e) => {
              onSelect(e.target.value)
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
            {volumes.map((v) => (
              <option key={v.path} value={v.path}>
                {v.label}
              </option>
            ))}
          </select>
        )}
        <button
          onClick={onRefresh}
          disabled={loading}
          title="Refresh volumes"
          style={{
            padding: '5px 8px',
            borderRadius: 4,
            fontSize: 12,
            cursor: loading ? 'default' : 'pointer',
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
  )
}

// ---------------------------------------------------------------------------
// Progress panels
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
  const phaseLabel: Record<typeof phase, string> = {
    downloading: 'Downloading firmware…',
    connecting: 'Connecting to device…',
    flashing: 'Flashing…',
  }

  const logEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontSize: 13, color: '#CCCCCC', marginBottom: 12 }}>{phaseLabel[phase]}</div>
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
  sdCopyResult,
}: {
  onClose: () => void
  sdCopyResult: SdCopyResult | null
}) {
  const sdSummary =
    sdCopyResult &&
    [
      `${String(sdCopyResult.copied)} file${sdCopyResult.copied !== 1 ? 's' : ''} copied`,
      sdCopyResult.skipped > 0 ? `${String(sdCopyResult.skipped)} skipped` : '',
    ]
      .filter(Boolean)
      .join(', ')

  return (
    <div style={{ textAlign: 'center', padding: '16px 0' }}>
      <div style={{ fontSize: 28, marginBottom: 12 }}>✓</div>
      <div style={{ fontSize: 14, color: '#44CC44', fontWeight: 600, marginBottom: 6 }}>
        Flash complete
      </div>
      {sdSummary && (
        <div style={{ fontSize: 11, color: '#555555', marginBottom: 4 }}>SD: {sdSummary}</div>
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

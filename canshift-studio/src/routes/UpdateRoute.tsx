// UpdateRoute.tsx — Firmware update panel (USB OTA, Phase 1)

import { useState, useRef, useEffect } from 'react'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'
import { IconUsb } from '../components/icons/Icon'
import { firmwareIpc } from '../services/ipc.service'
import type { FirmwareRelease } from '../services/ipc.service'
import { IpcChannels } from '../../main/ipc/ipc-channels'

type ManualState = 'idle' | 'ready' | 'flashing' | 'done' | 'error'
type ReleaseFlashState = 'idle' | 'downloading' | 'flashing' | 'done' | 'error'
type FlashChannel = 'stable' | 'beta'

export default function UpdateRoute() {
  const connected = useDeviceStore((s) => s.connected)
  const portPath = useDeviceStore((s) => s.portPath)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion)
  const log = useLogStore((s) => s.push)

  // ---- Release list state ----
  const [channel, setChannel] = useState<FlashChannel>('stable')
  const [releases, setReleases] = useState<FirmwareRelease[]>([])
  const [releasesLoading, setReleasesLoading] = useState(false)
  const [releasesError, setReleasesError] = useState<string | null>(null)
  const [expandedTag, setExpandedTag] = useState<string | null>(null)

  // Which release is currently being flashed (by tag), and its progress
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [flashState, setFlashState] = useState<ReleaseFlashState>('idle')
  const [flashProgress, setFlashProgress] = useState(0)
  const [flashPhase, setFlashPhase] = useState<'downloading' | 'flashing'>('downloading')
  const [flashError, setFlashError] = useState<string | null>(null)

  // ---- Manual file flash state ----
  const [manualState, setManualState] = useState<ManualState>('idle')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [manualProgress, setManualProgress] = useState(0)
  const [manualError, setManualError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch releases when channel changes
  useEffect(() => {
    let cancelled = false
    setReleasesLoading(true)
    setReleasesError(null)
    setReleases([])
    firmwareIpc
      .listReleases(channel)
      .then((list) => {
        if (!cancelled) setReleases(list)
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setReleasesError(err instanceof Error ? err.message : 'Failed to fetch releases')
      })
      .finally(() => {
        if (!cancelled) setReleasesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [channel])

  // Progress events from main process
  useEffect(() => {
    const handler = (payload: unknown) => {
      if (typeof payload !== 'object' || payload === null || !('pct' in payload)) return
      const { pct, phase } = payload as { pct: number; phase?: string }

      if (phase === 'downloading') {
        setFlashPhase('downloading')
        setFlashProgress(pct)
        return
      }

      // Flash phase — applies to both release flash and manual flash
      setFlashPhase('flashing')
      setFlashProgress(pct)
      setManualProgress(pct)

      if (pct >= 100) {
        setFlashState((s) => (s === 'flashing' ? 'done' : s))
        setManualState((s) => (s === 'flashing' ? 'done' : s))
        log('success', 'Firmware flashed successfully — reboot the device')
      }
    }
    window.ipc.on(IpcChannels.FIRMWARE_PROGRESS, handler)
    return () => {
      window.ipc.off(IpcChannels.FIRMWARE_PROGRESS, handler)
    }
  }, [log])

  // ---- Release flash handlers ----

  const flashBusy = flashState === 'downloading' || flashState === 'flashing'

  const handleFlashRelease = async (release: FirmwareRelease) => {
    if (flashBusy) return
    if (simulationMode) {
      setActiveTag(release.tag)
      setFlashState('downloading')
      setFlashProgress(0)
      setFlashPhase('downloading')
      log('info', `Downloading firmware v${release.version} (sim)…`)
      await new Promise<void>((r) => setTimeout(r, 700))
      setFlashProgress(100)
      setFlashPhase('flashing')
      setFlashState('flashing')
      let p = 0
      await new Promise<void>((r) => {
        const id = setInterval(() => {
          p += Math.random() * 12
          if (p >= 100) {
            clearInterval(id)
            setFlashProgress(100)
            setFlashState('done')
            log('success', `Firmware v${release.version} flashed (sim) — reboot the device`)
            r()
          } else {
            setFlashProgress(p)
          }
        }, 120)
      })
      return
    }
    if (!portPath) {
      setFlashError('No port path available — reconnect the device')
      setFlashState('error')
      return
    }
    setActiveTag(release.tag)
    setFlashState('downloading')
    setFlashProgress(0)
    setFlashPhase('downloading')
    setFlashError(null)
    log('info', `Downloading firmware v${release.version}…`)
    const result = await firmwareIpc.flashFromUrl(release.downloadUrl, release.tag, portPath)
    if (!result.success) {
      setFlashState('error')
      setFlashError(result.error ?? 'Flash failed')
      log('error', `Firmware flash failed: ${result.error ?? 'unknown'}`)
    } else {
      log('success', `Firmware v${release.version} flashed — reboot the device`)
    }
  }

  const handleFlashReset = () => {
    setActiveTag(null)
    setFlashState('idle')
    setFlashProgress(0)
    setFlashError(null)
  }

  // ---- Manual flash handlers ----

  const canManualFlash = (connected || simulationMode) && selectedFile !== null

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    if (!file) return
    if (!file.name.endsWith('.bin')) {
      setManualError('Invalid file — expected a .bin firmware image')
      setManualState('error')
      return
    }
    setSelectedFile(file)
    setManualState('ready')
    setManualError(null)
  }

  const handleManualFlash = async () => {
    if (!connected && !simulationMode) return
    if (!selectedFile) return
    if (simulationMode) {
      log('info', `Firmware update (sim) — ${selectedFile.name}`)
      setManualState('flashing')
      setManualProgress(0)
      let p = 0
      const id = setInterval(() => {
        p += Math.random() * 12
        if (p >= 100) {
          clearInterval(id)
          setManualProgress(100)
          setManualState('done')
          log('success', 'Firmware update complete (simulated)')
        } else {
          setManualProgress(p)
        }
      }, 120)
      return
    }
    if (!portPath) {
      setManualError('No port path available — reconnect the device')
      setManualState('error')
      return
    }
    setManualState('flashing')
    setManualProgress(0)
    log('info', `Flashing ${selectedFile.name} to ${portPath}…`)
    const filePath = (selectedFile as File & { path: string }).path
    const result = await firmwareIpc.updateViaUsb(portPath, filePath)
    if (!result.success) {
      setManualState('error')
      setManualError(result.error ?? 'Flash failed — check the device is in normal boot mode')
      log('error', `Firmware flash failed: ${result.error ?? 'unknown'}`)
    }
  }

  const handleManualReset = () => {
    setManualState('idle')
    setSelectedFile(null)
    setManualProgress(0)
    setManualError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const canFlashAny = connected || simulationMode

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: 32,
        gap: 24,
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ width: '100%', maxWidth: 480 }}>
        <h2
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: '#CCCCCC',
            marginBottom: 4,
            letterSpacing: '0.04em',
          }}
        >
          Firmware Update
        </h2>
        <p style={{ fontSize: 12, color: '#AAAAAA' }}>
          Flash a new firmware binary to the connected CANShift device over USB.
        </p>
      </div>

      {/* Device status */}
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#161616',
          border: '1px solid #222222',
          borderRadius: 6,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <IconUsb size={16} color={canFlashAny ? '#55AA55' : '#AAAAAA'} />
        <div>
          <div style={{ fontSize: 12, color: '#AAAAAA', fontWeight: 600 }}>
            {simulationMode
              ? 'Simulation mode'
              : connected
                ? 'Device connected'
                : 'No device connected'}
          </div>
          {firmwareVersion && (
            <div style={{ fontSize: 11, color: '#555555', marginTop: 2 }}>
              Current firmware: v{firmwareVersion}
            </div>
          )}
          {!connected && !simulationMode && (
            <div style={{ fontSize: 11, color: '#555555', marginTop: 2 }}>
              Connect via USB to enable flashing
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Release list                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        {/* Channel toggle + title */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#888888',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            GitHub Releases
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['stable', 'beta'] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => {
                  setChannel(ch)
                  handleFlashReset()
                }}
                disabled={flashBusy}
                style={{
                  padding: '2px 10px',
                  background: channel === ch ? '#1A1A2A' : 'transparent',
                  border: `1px solid ${channel === ch ? '#4455AA' : '#2A2A2A'}`,
                  borderRadius: 3,
                  color: channel === ch ? '#7788CC' : '#444444',
                  fontSize: 10,
                  cursor: flashBusy ? 'default' : 'pointer',
                  letterSpacing: '0.04em',
                }}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {releasesLoading && (
          <div style={{ fontSize: 11, color: '#444444', padding: '8px 0' }}>Fetching releases…</div>
        )}

        {/* Error fetching */}
        {releasesError && (
          <div
            style={{
              fontSize: 11,
              color: '#884444',
              padding: '8px 12px',
              background: '#1A0D0D',
              border: '1px solid #552222',
              borderRadius: 5,
            }}
          >
            {releasesError}
          </div>
        )}

        {/* Release rows */}
        {releases.map((release, i) => {
          const isActive = activeTag === release.tag
          const rowState = isActive ? flashState : 'idle'
          const isLatest = i === 0

          return (
            <div
              key={release.tag}
              style={{
                background: '#161616',
                border: `1px solid ${isActive && flashState !== 'idle' ? '#333333' : '#1E1E1E'}`,
                borderRadius: 6,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {/* Version row — click to toggle release notes */}
              <div
                onClick={() => {
                  setExpandedTag((t) => (t === release.tag ? null : release.tag))
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: '#CCCCCC' }}>
                  v{release.version}
                </span>
                {isLatest && (
                  <span
                    style={{
                      fontSize: 9,
                      color: '#55AA55',
                      border: '1px solid #225522',
                      borderRadius: 3,
                      padding: '1px 5px',
                      letterSpacing: '0.05em',
                    }}
                  >
                    LATEST
                  </span>
                )}
                {release.prerelease && (
                  <span
                    style={{
                      fontSize: 9,
                      color: '#AA7733',
                      border: '1px solid #553311',
                      borderRadius: 3,
                      padding: '1px 5px',
                      letterSpacing: '0.05em',
                    }}
                  >
                    PRE-RELEASE
                  </span>
                )}
                <span style={{ fontSize: 10, color: '#444444', marginLeft: 'auto' }}>
                  {new Date(release.publishedAt).toLocaleDateString()}
                </span>
                <span style={{ fontSize: 10, color: '#333333' }}>
                  {expandedTag === release.tag ? '▲' : '▼'}
                </span>
              </div>

              {/* Release notes (expanded) */}
              {expandedTag === release.tag && release.notes && (
                <div
                  style={{
                    borderTop: '1px solid #1E1E1E',
                    paddingTop: 8,
                    fontSize: 11,
                    color: '#888888',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    maxHeight: 180,
                    overflowY: 'auto',
                  }}
                >
                  {release.notes}
                </div>
              )}
              {expandedTag === release.tag && !release.notes && (
                <div
                  style={{
                    borderTop: '1px solid #1E1E1E',
                    paddingTop: 8,
                    fontSize: 11,
                    color: '#444444',
                  }}
                >
                  No release notes.
                </div>
              )}

              {/* Progress (active flash) */}
              {isActive && (rowState === 'downloading' || rowState === 'flashing') && (
                <div>
                  <div
                    style={{
                      height: 3,
                      background: '#1C1C1C',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${String(Math.round(flashProgress))}%`,
                        background: flashPhase === 'downloading' ? '#4477CC' : '#FF4444',
                        borderRadius: 2,
                        transition: 'width 0.15s',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 10,
                      color: '#555555',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{flashPhase === 'downloading' ? 'Downloading…' : 'Flashing…'}</span>
                    <span>{Math.round(flashProgress)}%</span>
                  </div>
                </div>
              )}

              {/* Done */}
              {isActive && rowState === 'done' && (
                <div style={{ fontSize: 11, color: '#55AA55' }}>
                  ✓ Flashed successfully — reboot the device
                </div>
              )}

              {/* Error */}
              {isActive && rowState === 'error' && flashError && (
                <div style={{ fontSize: 11, color: '#CC4444' }}>{flashError}</div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 6 }}>
                {isActive && (rowState === 'done' || rowState === 'error') && (
                  <button
                    onClick={handleFlashReset}
                    style={{
                      padding: '5px 12px',
                      background: 'transparent',
                      border: '1px solid #2A2A2A',
                      borderRadius: 4,
                      color: '#888888',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    Reset
                  </button>
                )}
                <button
                  onClick={() => {
                    void handleFlashRelease(release)
                  }}
                  disabled={!canFlashAny || flashBusy || (isActive && rowState === 'done')}
                  style={{
                    flex: 1,
                    padding: '5px 0',
                    background:
                      canFlashAny && !(isActive && rowState === 'done')
                        ? isLatest
                          ? '#1A1A0D'
                          : '#111111'
                        : '#111111',
                    border: `1px solid ${canFlashAny && !(isActive && rowState === 'done') ? (isLatest ? '#CC8800' : '#2A2A2A') : '#1E1E1E'}`,
                    borderRadius: 4,
                    color:
                      canFlashAny && !(isActive && rowState === 'done')
                        ? isLatest
                          ? '#CCAA33'
                          : '#AAAAAA'
                        : '#333333',
                    fontSize: 11,
                    fontWeight: isLatest ? 600 : 400,
                    cursor:
                      canFlashAny && !flashBusy && !(isActive && rowState === 'done')
                        ? 'pointer'
                        : 'default',
                    letterSpacing: '0.03em',
                  }}
                >
                  {isActive && rowState === 'downloading'
                    ? 'Downloading…'
                    : isActive && rowState === 'flashing'
                      ? 'Flashing…'
                      : isLatest
                        ? 'Flash Latest'
                        : 'Flash'}
                </button>
              </div>
            </div>
          )
        })}

        {/* Empty state */}
        {!releasesLoading && !releasesError && releases.length === 0 && (
          <div style={{ fontSize: 11, color: '#444444', padding: '8px 0' }}>
            No releases found for this channel.
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Manual file flash                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ width: '100%', maxWidth: 480 }}>
        <label
          style={{
            display: 'block',
            fontSize: 10,
            color: '#444444',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Or flash a local file (.bin)
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".bin"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        <button
          onClick={() => {
            fileInputRef.current?.click()
          }}
          disabled={manualState === 'flashing'}
          style={{
            width: '100%',
            padding: '10px 16px',
            background: '#161616',
            border: `1px dashed ${selectedFile ? '#336633' : '#2A2A2A'}`,
            borderRadius: 6,
            color: selectedFile ? '#55AA55' : '#555555',
            fontSize: 12,
            cursor: manualState === 'flashing' ? 'default' : 'pointer',
            textAlign: 'center',
            transition: 'border-color 0.1s, color 0.1s',
          }}
          onMouseEnter={(e) => {
            if (manualState !== 'flashing')
              e.currentTarget.style.borderColor = selectedFile ? '#448844' : '#AAAAAA'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = selectedFile ? '#336633' : '#2A2A2A'
          }}
        >
          {selectedFile ? `✓ ${selectedFile.name}` : 'Select firmware file…'}
        </button>
      </div>

      {/* Manual flash progress */}
      {manualState === 'flashing' && (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <div style={{ height: 4, background: '#1C1C1C', borderRadius: 2, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${String(Math.round(manualProgress))}%`,
                background: '#FF4444',
                borderRadius: 2,
                transition: 'width 0.1s',
              }}
            />
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: '#555555', textAlign: 'right' }}>
            {Math.round(manualProgress)}%
          </div>
        </div>
      )}

      {manualState === 'done' && (
        <div
          style={{
            width: '100%',
            maxWidth: 480,
            padding: '10px 16px',
            background: '#0D1A0D',
            border: '1px solid #225522',
            borderRadius: 6,
            fontSize: 12,
            color: '#55AA55',
          }}
        >
          ✓ Firmware flashed successfully. Reboot the device to apply.
        </div>
      )}

      {(manualState === 'error' || manualError) && (
        <div
          style={{
            width: '100%',
            maxWidth: 480,
            padding: '10px 16px',
            background: '#1A0D0D',
            border: '1px solid #552222',
            borderRadius: 6,
            fontSize: 12,
            color: '#CC4444',
          }}
        >
          {manualError ?? 'An unknown error occurred'}
        </div>
      )}

      <div style={{ width: '100%', maxWidth: 480, display: 'flex', gap: 10 }}>
        {manualState !== 'idle' && (
          <button
            onClick={handleManualReset}
            disabled={manualState === 'flashing'}
            style={{
              flex: 1,
              padding: '8px 0',
              background: 'transparent',
              border: '1px solid #2A2A2A',
              borderRadius: 5,
              color: '#888888',
              fontSize: 12,
              cursor: manualState === 'flashing' ? 'default' : 'pointer',
            }}
          >
            Reset
          </button>
        )}
        <button
          onClick={handleManualFlash}
          disabled={!canManualFlash || manualState === 'flashing' || manualState === 'done'}
          style={{
            flex: 3,
            padding: '8px 0',
            background: canManualFlash && manualState !== 'done' ? '#1A0D0D' : '#111111',
            border: `1px solid ${canManualFlash && manualState !== 'done' ? '#CC3333' : '#222222'}`,
            borderRadius: 5,
            color: canManualFlash && manualState !== 'done' ? '#CC4444' : '#333333',
            fontSize: 12,
            fontWeight: 600,
            cursor:
              canManualFlash && manualState !== 'flashing' && manualState !== 'done'
                ? 'pointer'
                : 'default',
            letterSpacing: '0.04em',
          }}
        >
          {manualState === 'flashing' ? 'Flashing…' : 'Flash Firmware'}
        </button>
      </div>

      {/* Wi-Fi note */}
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          padding: '8px 12px',
          background: '#111111',
          border: '1px solid #1A1A1A',
          borderRadius: 5,
          fontSize: 11,
          color: '#2A2A2A',
        }}
      >
        Wi-Fi OTA — Phase 2
      </div>
    </div>
  )
}

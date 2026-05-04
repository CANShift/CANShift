// UpdateRoute.tsx — Firmware update panel (USB OTA, Phase 1)

import { useState, useRef, useEffect } from 'react'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'
import { IconUsb } from '../components/icons/Icon'
import { firmwareIpc } from '../services/ipc.service'
import { useFirmwareFlash } from '../hooks/useFirmwareFlash'
import type { FirmwareRelease } from '../services/ipc.service'

type FlashChannel = 'stable' | 'beta'
type ActiveFlash = { type: 'release'; tag: string } | { type: 'manual' } | null

export default function UpdateRoute() {
  const connected = useDeviceStore((s) => s.connected)
  const portPath = useDeviceStore((s) => s.portPath)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion)
  const log = useLogStore((s) => s.push)

  const {
    state,
    phase,
    progress,
    logs: _flashLogs,
    error: flashError,
    flash,
    reset: flashReset,
  } = useFirmwareFlash()

  // ---- Release list state ----
  const [channel, setChannel] = useState<FlashChannel>('stable')
  const [releases, setReleases] = useState<FirmwareRelease[]>([])
  const [releasesLoading, setReleasesLoading] = useState(false)
  const [releasesError, setReleasesError] = useState<string | null>(null)
  const [latestNotesOpen, setLatestNotesOpen] = useState(false)
  const [selectedOlderTag, setSelectedOlderTag] = useState<string>('')
  const [olderNotesOpen, setOlderNotesOpen] = useState(false)

  // Identifies which flash is currently active
  const [activeFlash, setActiveFlash] = useState<ActiveFlash>(null)

  // ---- Manual file flash state ----
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [manualError, setManualError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // ---- Derived state ----

  const flashBusy = state === 'downloading' || state === 'connecting' || state === 'flashing'
  const canFlashAny = connected || simulationMode

  // ---- Release flash handlers ----

  const handleFlashRelease = async (release: FirmwareRelease) => {
    if (flashBusy) return
    if (!portPath && !simulationMode) {
      log('error', 'No port path available — reconnect the device')
      return
    }
    setActiveFlash({ type: 'release', tag: release.tag })
    log('info', `Downloading firmware v${release.version}…`)
    const result = await flash(
      { type: 'url', url: release.downloadUrl ?? '' },
      portPath ?? '',
      `v${release.version}`
    )
    if (result.success) {
      log('success', `Firmware v${release.version} flashed — reboot the device`)
    } else {
      log('error', `Firmware flash failed: ${result.error ?? 'unknown'}`)
    }
  }

  const handleFlashReset = () => {
    setActiveFlash(null)
    flashReset()
  }

  // ---- Manual flash handlers ----

  const canManualFlash = (connected || simulationMode) && selectedFile !== null

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    if (!file) return
    if (!file.name.endsWith('.bin')) {
      setManualError('Invalid file — expected a .bin firmware image')
      return
    }
    setSelectedFile(file)
    setManualError(null)
  }

  const handleManualFlash = async () => {
    if (!selectedFile) return
    if (!canManualFlash) return
    if (!portPath && !simulationMode) {
      setManualError('No port path available — reconnect the device')
      return
    }
    setActiveFlash({ type: 'manual' })
    setManualError(null)
    log('info', `Flashing ${selectedFile.name}…`)
    const result = await flash({ type: 'file', file: selectedFile }, portPath ?? '')
    if (result.success) {
      log('success', `Firmware flashed — reboot the device`)
    } else {
      setManualError(result.error ?? 'Flash failed')
      log('error', `Firmware flash failed: ${result.error ?? 'unknown'}`)
    }
  }

  const handleManualReset = () => {
    setActiveFlash(null)
    flashReset()
    setSelectedFile(null)
    setManualError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ---- Sub-renderers ----

  const renderProgress = () => (
    <div>
      <div style={{ height: 3, background: '#1C1C1C', borderRadius: 2, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${String(Math.round(progress))}%`,
            background: phase === 'downloading' ? '#4477CC' : '#FF4444',
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
        <span>
          {phase === 'downloading'
            ? 'Downloading…'
            : phase === 'connecting'
              ? 'Connecting…'
              : 'Flashing…'}
        </span>
        <span>{Math.round(progress)}%</span>
      </div>
    </div>
  )

  const renderReleaseCard = (release: FirmwareRelease, isLatest: boolean) => {
    const isActive = activeFlash?.type === 'release' && activeFlash.tag === release.tag
    const hasBinary = !!release.downloadUrl
    const notesOpen = isLatest ? latestNotesOpen : olderNotesOpen
    const setNotesOpen = isLatest
      ? () => {
          setLatestNotesOpen((o) => !o)
        }
      : () => {
          setOlderNotesOpen((o) => !o)
        }

    const showProgress = isActive && flashBusy
    const showDone = isActive && state === 'done'
    const showError = isActive && state === 'error' && flashError

    return (
      <div
        style={{
          background: '#161616',
          border: `1px solid ${isActive && state !== 'idle' ? '#333333' : '#1E1E1E'}`,
          borderRadius: 6,
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
          {release.notes && (
            <button
              onClick={setNotesOpen}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                fontSize: 10,
                color: '#333333',
                cursor: 'pointer',
              }}
            >
              {notesOpen ? '▲' : '▼'}
            </button>
          )}
        </div>

        {notesOpen && (
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

        {showProgress && renderProgress()}

        {showDone && (
          <div style={{ fontSize: 11, color: '#55AA55' }}>
            ✓ Flashed successfully — reboot the device
          </div>
        )}
        {showError && <div style={{ fontSize: 11, color: '#CC4444' }}>{flashError}</div>}

        <div style={{ display: 'flex', gap: 6 }}>
          {isActive && (state === 'done' || state === 'error') && (
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
            disabled={!canFlashAny || !hasBinary || flashBusy || (isActive && state === 'done')}
            title={!hasBinary ? 'No firmware binary attached to this release' : undefined}
            style={{
              flex: 1,
              padding: '5px 0',
              background: isLatest
                ? canFlashAny && hasBinary && !(isActive && state === 'done')
                  ? '#1A1A0D'
                  : '#111111'
                : '#111111',
              border: `1px solid ${
                canFlashAny && hasBinary && !(isActive && state === 'done')
                  ? isLatest
                    ? '#CC8800'
                    : '#2A2A2A'
                  : '#1E1E1E'
              }`,
              borderRadius: 4,
              color:
                canFlashAny && hasBinary && !(isActive && state === 'done')
                  ? isLatest
                    ? '#CCAA33'
                    : '#AAAAAA'
                  : '#333333',
              fontSize: 11,
              fontWeight: 600,
              cursor:
                canFlashAny && hasBinary && !flashBusy && !(isActive && state === 'done')
                  ? 'pointer'
                  : 'default',
              letterSpacing: '0.03em',
            }}
          >
            {isActive && state === 'downloading'
              ? 'Downloading…'
              : isActive && (state === 'connecting' || state === 'flashing')
                ? 'Flashing…'
                : hasBinary
                  ? isLatest
                    ? 'Flash Latest'
                    : 'Flash'
                  : 'No binary'}
          </button>
        </div>
      </div>
    )
  }

  const latestRelease = releases[0]
  const olderReleases = releases.slice(1)
  const selectedOlderRelease = olderReleases.find((r) => r.tag === selectedOlderTag) ?? null

  const isManualActive = activeFlash?.type === 'manual'
  const showManualProgress = isManualActive && flashBusy
  const showManualDone = isManualActive && state === 'done'
  const showManualError = isManualActive && state === 'error'

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
        {/* Channel toggle */}
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

        {releasesLoading && (
          <div style={{ fontSize: 11, color: '#444444', padding: '8px 0' }}>Fetching releases…</div>
        )}

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

        {latestRelease && renderReleaseCard(latestRelease, true)}

        {/* Older releases — scrollable select */}
        {olderReleases.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <select
              value={selectedOlderTag}
              onChange={(e) => {
                setSelectedOlderTag(e.target.value)
                setOlderNotesOpen(false)
              }}
              style={{
                width: '100%',
                padding: '7px 10px',
                background: '#111111',
                border: '1px solid #222222',
                borderRadius: 5,
                color: selectedOlderTag ? '#AAAAAA' : '#444444',
                fontSize: 11,
                cursor: 'pointer',
                appearance: 'none',
              }}
            >
              <option value="">Older releases…</option>
              {olderReleases.map((r) => (
                <option key={r.tag} value={r.tag}>
                  v{r.version} — {new Date(r.publishedAt).toLocaleDateString()}
                  {r.prerelease ? ' (pre-release)' : ''}
                </option>
              ))}
            </select>

            {selectedOlderRelease && renderReleaseCard(selectedOlderRelease, false)}
          </div>
        )}

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
          disabled={flashBusy}
          style={{
            width: '100%',
            padding: '10px 16px',
            background: '#161616',
            border: `1px dashed ${selectedFile ? '#336633' : '#2A2A2A'}`,
            borderRadius: 6,
            color: selectedFile ? '#55AA55' : '#555555',
            fontSize: 12,
            cursor: flashBusy ? 'default' : 'pointer',
            textAlign: 'center',
            transition: 'border-color 0.1s, color 0.1s',
          }}
          onMouseEnter={(e) => {
            if (!flashBusy) e.currentTarget.style.borderColor = selectedFile ? '#448844' : '#AAAAAA'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = selectedFile ? '#336633' : '#2A2A2A'
          }}
        >
          {selectedFile ? `✓ ${selectedFile.name}` : 'Select firmware file…'}
        </button>
      </div>

      {showManualProgress && <div style={{ width: '100%', maxWidth: 480 }}>{renderProgress()}</div>}

      {showManualDone && (
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

      {(showManualError || manualError) && (
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
          {flashError ?? manualError ?? 'An unknown error occurred'}
        </div>
      )}

      <div style={{ width: '100%', maxWidth: 480, display: 'flex', gap: 10 }}>
        {isManualActive && (state === 'done' || state === 'error') && (
          <button
            onClick={handleManualReset}
            style={{
              flex: 1,
              padding: '8px 0',
              background: 'transparent',
              border: '1px solid #2A2A2A',
              borderRadius: 5,
              color: '#888888',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        )}
        <button
          onClick={() => {
            void handleManualFlash()
          }}
          disabled={!canManualFlash || flashBusy || (isManualActive && state === 'done')}
          style={{
            flex: 3,
            padding: '8px 0',
            background:
              canManualFlash && !(isManualActive && state === 'done') ? '#1A0D0D' : '#111111',
            border: `1px solid ${
              canManualFlash && !(isManualActive && state === 'done') ? '#CC3333' : '#222222'
            }`,
            borderRadius: 5,
            color: canManualFlash && !(isManualActive && state === 'done') ? '#CC4444' : '#333333',
            fontSize: 12,
            fontWeight: 600,
            cursor:
              canManualFlash && !flashBusy && !(isManualActive && state === 'done')
                ? 'pointer'
                : 'default',
            letterSpacing: '0.04em',
          }}
        >
          {isManualActive && flashBusy ? 'Flashing…' : 'Flash Firmware'}
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

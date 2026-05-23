// UpdateRoute.tsx — Firmware update panel.
//
// Replaces the old auto-popup FirmwareDialog. The panel surfaces the result
// of the version probe (`firmwareCheck` slice on the device store), exposes
// a "Check now" button, and lets the user pick + flash a release (or a local
// .bin).

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'
import { useFirmwareReleasesStore } from '../stores/firmwareReleases.store'
import { IconUsb } from '../components/icons/Icon'
import { Spinner } from '../components/shared/PhaseIndicator'
import { SafeMarkdown } from '../components/shared/SafeMarkdown'
import { useFirmwareFlash } from '../hooks/useFirmwareFlash'
import { Label } from '@/components/ui/label'
import type { FirmwareRelease } from '../services/ipc.service'
import type { FirmwareCheck } from '../stores/device.store'
import type { FirmwareChannel } from '../stores/firmwareReleases.store'

type FlashChannel = FirmwareChannel
type ActiveFlash = { type: 'release'; tag: string } | { type: 'manual' } | null

// Heuristic flash speed used to render an ETA next to the Flash button.
// Empirically the Crowpanel 2.8" target writes a ~1.4 MB merged image in
// roughly 25 s on USB. Used only for display — not authoritative.
const ETA_REFERENCE_BYTES = 1.4 * 1024 * 1024
const ETA_REFERENCE_SECONDS = 25

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${String(bytes)} B`
}

function estimateFlashSeconds(bytes: number): number {
  return Math.max(1, Math.ceil((bytes / ETA_REFERENCE_BYTES) * ETA_REFERENCE_SECONDS))
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp
  if (diffMs < 60_000) return 'just now'
  if (diffMs < 3_600_000) return `${String(Math.floor(diffMs / 60_000))} min ago`
  if (diffMs < 86_400_000) return `${String(Math.floor(diffMs / 3_600_000))} h ago`
  return new Date(timestamp).toLocaleString()
}

interface CheckHeaderCopy {
  title: string
  detail: string
  tone: 'idle' | 'success' | 'warn' | 'progress'
  showRecheck: boolean
}

function checkHeaderCopy(check: FirmwareCheck, connected: boolean): CheckHeaderCopy {
  switch (check.kind) {
    case 'idle':
      return {
        title: connected ? 'Probing firmware…' : 'No device connected',
        detail: connected
          ? 'Reading the version reported by the device.'
          : 'Plug in your CANShift dashboard via USB to check or update its firmware.',
        tone: connected ? 'progress' : 'idle',
        showRecheck: false,
      }
    case 'probing':
      return {
        title: 'Checking for updates…',
        detail: 'Asking the device for its firmware version and comparing against GitHub.',
        tone: 'progress',
        showRecheck: false,
      }
    case 'no_firmware':
      return {
        title: 'No CANShift firmware detected',
        detail:
          'The device responded but does not run CANShift firmware. Pick a release below and flash it.',
        tone: 'warn',
        showRecheck: true,
      }
    case 'up_to_date':
      return {
        title: `Up to date (v${check.version})`,
        detail: `Last checked ${formatRelativeTime(check.checkedAt)}.`,
        tone: 'success',
        showRecheck: true,
      }
    case 'update_available':
      return {
        title: `Update available — v${check.latestVersion}`,
        detail: `Currently running v${check.version}. Last checked ${formatRelativeTime(check.checkedAt)}.`,
        tone: 'warn',
        showRecheck: true,
      }
    case 'check_failed':
      return {
        title: `Couldn't reach the release server`,
        detail: `Running v${check.version}. Last attempt ${formatRelativeTime(check.checkedAt)}.`,
        tone: 'warn',
        showRecheck: true,
      }
  }
}

const TONE_BORDER: Record<CheckHeaderCopy['tone'], string> = {
  idle: '#222222',
  progress: '#444466',
  success: '#225522',
  warn: '#553311',
}

const TONE_ACCENT: Record<CheckHeaderCopy['tone'], string> = {
  idle: '#666666',
  progress: '#7788CC',
  success: '#3DB86B',
  warn: '#CC8844',
}

export default function UpdateRoute() {
  const connected = useDeviceStore((s) => s.connected)
  const portPath = useDeviceStore((s) => s.portPath)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion)
  const firmwareCheck = useDeviceStore((s) => s.firmwareCheck)
  const requestFirmwareRecheck = useDeviceStore((s) => s.requestFirmwareRecheck)
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
  const releases = useFirmwareReleasesStore((s) => s.byChannel[channel].releases)
  const releasesLoading = useFirmwareReleasesStore((s) => s.byChannel[channel].loading)
  const releasesError = useFirmwareReleasesStore((s) => s.byChannel[channel].error)
  const loadReleasesChannel = useFirmwareReleasesStore((s) => s.loadChannel)
  const [latestNotesOpen, setLatestNotesOpen] = useState(false)
  const [selectedOlderTag, setSelectedOlderTag] = useState<string>('')
  const [olderNotesOpen, setOlderNotesOpen] = useState(false)

  // Identifies which flash is currently active
  const [activeFlash, setActiveFlash] = useState<ActiveFlash>(null)

  // ---- Manual file flash state ----
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [manualError, setManualError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Idiomatic Zustand bridge — the side effect is in the store action; this
  // effect only schedules the fetch when the channel changes.
  useEffect(() => {
    void loadReleasesChannel(channel)
  }, [channel, loadReleasesChannel])

  // ---- Derived state ----

  const flashBusy = state === 'downloading' || state === 'connecting' || state === 'flashing'
  const canFlashAny = connected || simulationMode

  const headerCopy = useMemo(
    () => checkHeaderCopy(firmwareCheck, connected || simulationMode),
    [firmwareCheck, connected, simulationMode]
  )

  // ---- Release flash handlers ----

  const handleFlashRelease = async (release: FirmwareRelease): Promise<void> => {
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
      `v${release.version}`,
      release.spiffsUrl
    )
    if (result.success) {
      log('success', `Firmware v${release.version} flashed — reboot the device`)
      toast.success(`Firmware v${release.version} flashed`)
    } else {
      log('error', `Firmware flash failed: ${result.error ?? 'unknown'}`)
      toast.error(`Firmware flash failed: ${result.error ?? 'unknown'}`)
    }
  }

  const handleFlashReset = (): void => {
    setActiveFlash(null)
    flashReset()
  }

  // ---- Manual flash handlers ----

  const canManualFlash = (connected || simulationMode) && selectedFile !== null

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0] ?? null
    if (!file) return
    if (!file.name.endsWith('.bin')) {
      setManualError('Invalid file — expected a .bin firmware image')
      return
    }
    setSelectedFile(file)
    setManualError(null)
  }

  const handleManualFlash = async (): Promise<void> => {
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
      toast.success('Firmware flashed')
    } else {
      setManualError(result.error ?? 'Flash failed')
      log('error', `Firmware flash failed: ${result.error ?? 'unknown'}`)
      toast.error(`Firmware flash failed: ${result.error ?? 'unknown'}`)
    }
  }

  const handleManualReset = (): void => {
    setActiveFlash(null)
    flashReset()
    setSelectedFile(null)
    setManualError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ---- Sub-renderers ----

  const renderProgress = (): React.JSX.Element => (
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

  const renderReleaseCard = (release: FirmwareRelease, isLatest: boolean): React.JSX.Element => {
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

    const sizeHint = release.payloadBytes
      ? `${formatBytes(release.payloadBytes)} · ~${String(estimateFlashSeconds(release.payloadBytes))} s`
      : null

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
              maxHeight: 240,
              overflowY: 'auto',
            }}
          >
            <SafeMarkdown source={release.notes} className="text-xs" />
          </div>
        )}

        {showProgress && renderProgress()}

        {showDone && (
          <div style={{ fontSize: 11, color: '#55AA55' }}>
            ✓ Flashed successfully — reboot the device
          </div>
        )}
        {showError && <div style={{ fontSize: 11, color: '#CC4444' }}>{flashError}</div>}

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {sizeHint && !showProgress && !showDone && !showError && (
            <span style={{ fontSize: 10, color: '#555555' }}>{sizeHint}</span>
          )}
          <div style={{ flex: 1 }} />
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
              padding: '5px 14px',
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
        gap: 20,
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
        <p style={{ fontSize: 12, color: '#888888' }}>
          Flash a new firmware binary to the connected CANShift device over USB.
        </p>
      </div>

      {/* Firmware check banner */}
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#161616',
          border: `1px solid ${TONE_BORDER[headerCopy.tone]}`,
          borderRadius: 6,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {firmwareCheck.kind === 'probing' ? (
            <span style={{ flexShrink: 0, marginTop: 2 }}>
              <Spinner color={TONE_ACCENT.progress} size={20} />
            </span>
          ) : (
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                marginTop: 6,
                borderRadius: '50%',
                background: TONE_ACCENT[headerCopy.tone],
                flexShrink: 0,
              }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                color: TONE_ACCENT[headerCopy.tone],
                fontWeight: 600,
                marginBottom: 2,
              }}
            >
              {headerCopy.title}
            </div>
            <div style={{ fontSize: 11, color: '#888888', lineHeight: 1.5 }}>
              {headerCopy.detail}
            </div>
          </div>
          {headerCopy.showRecheck && (connected || simulationMode) && (
            <button
              onClick={requestFirmwareRecheck}
              disabled={firmwareCheck.kind === 'probing'}
              style={{
                padding: '5px 12px',
                background: 'transparent',
                border: '1px solid #2A2A2A',
                borderRadius: 4,
                color: '#AAAAAA',
                fontSize: 11,
                cursor: firmwareCheck.kind === 'probing' ? 'default' : 'pointer',
                flexShrink: 0,
              }}
            >
              Check now
            </button>
          )}
        </div>
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
        <Label
          htmlFor="manual-flash-input"
          className="mb-2 block text-[10px] uppercase tracking-[0.08em] text-text-muted"
        >
          Or flash a local file (.bin)
        </Label>
        <input
          id="manual-flash-input"
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
    </div>
  )
}

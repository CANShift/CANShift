// UpdateRoute.tsx — Firmware update panel (USB OTA, Phase 1)

import { useState, useRef, useEffect } from 'react'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'
import { IconUsb } from '../components/icons/Icon'
import { firmwareIpc } from '../services/ipc.service'
import type { FirmwareRelease } from '../services/ipc.service'
import { IpcChannels } from '../../main/ipc/ipc-channels'

type UpdateState = 'idle' | 'ready' | 'downloading' | 'flashing' | 'done' | 'error'
type FlashChannel = 'stable' | 'beta'

export default function UpdateRoute() {
  const connected = useDeviceStore((s) => s.connected)
  const portPath = useDeviceStore((s) => s.portPath)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion)
  const log = useLogStore((s) => s.push)

  // Manual file flash state
  const [updateState, setUpdateState] = useState<UpdateState>('idle')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Flash-latest state
  const [channel, setChannel] = useState<FlashChannel>('stable')
  const [latestRelease, setLatestRelease] = useState<FirmwareRelease | null>(null)
  const [latestLoading, setLatestLoading] = useState(false)
  const [latestError, setLatestError] = useState<string | null>(null)
  const [latestState, setLatestState] = useState<
    'idle' | 'downloading' | 'flashing' | 'done' | 'error'
  >('idle')
  const [latestProgress, setLatestProgress] = useState(0)
  const [latestPhase, setLatestPhase] = useState<'downloading' | 'flashing'>('downloading')

  // Fetch latest release on mount and when channel changes
  useEffect(() => {
    let cancelled = false
    setLatestLoading(true)
    setLatestError(null)
    setLatestRelease(null)
    firmwareIpc
      .listReleases(channel)
      .then((releases) => {
        if (cancelled) return
        setLatestRelease(releases[0] ?? null)
        if (!releases[0]) setLatestError('No releases found for this channel')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLatestError(err instanceof Error ? err.message : 'Failed to fetch releases')
      })
      .finally(() => {
        if (!cancelled) setLatestLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [channel])

  // Subscribe to flash/download progress events from the main process.
  // Phase 'downloading' → latestProgress; phase absent or 'flashing' → updateState/latestState progress.
  useEffect(() => {
    const handler = (payload: unknown) => {
      if (typeof payload !== 'object' || payload === null || !('pct' in payload)) return
      const { pct, phase } = payload as { pct: number; phase?: string }

      if (phase === 'downloading') {
        setLatestPhase('downloading')
        setLatestProgress(pct)
        return
      }

      // Flash progress — applies to whichever operation is active
      setLatestPhase('flashing')
      setLatestProgress(pct)
      setProgress(pct)

      if (pct >= 100) {
        setUpdateState((s) => (s === 'flashing' ? 'done' : s))
        setLatestState((s) => (s === 'flashing' ? 'done' : s))
        log('success', 'Firmware flashed successfully — reboot the device')
      }
    }
    window.ipc.on(IpcChannels.FIRMWARE_PROGRESS, handler)
    return () => {
      window.ipc.off(IpcChannels.FIRMWARE_PROGRESS, handler)
    }
  }, [log])

  // ---- Manual file flash ----

  const canFlash = (connected || simulationMode) && selectedFile !== null

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    if (!file) return
    if (!file.name.endsWith('.bin')) {
      setErrorMsg('Invalid file — expected a .bin firmware image')
      setUpdateState('error')
      return
    }
    setSelectedFile(file)
    setUpdateState('ready')
    setErrorMsg(null)
  }

  const handleFlash = async () => {
    if (!connected && !simulationMode) return
    if (!selectedFile) return
    if (simulationMode) {
      log('info', `Firmware update (sim) — ${selectedFile.name}`)
      setUpdateState('flashing')
      setProgress(0)
      let p = 0
      const id = setInterval(() => {
        p += Math.random() * 12
        if (p >= 100) {
          p = 100
          clearInterval(id)
          setProgress(100)
          setUpdateState('done')
          log('success', 'Firmware update complete (simulated)')
        } else {
          setProgress(p)
        }
      }, 120)
      return
    }
    if (!portPath) {
      setErrorMsg('No port path available — reconnect the device')
      setUpdateState('error')
      return
    }
    setUpdateState('flashing')
    setProgress(0)
    log('info', `Flashing ${selectedFile.name} to ${portPath}…`)
    const filePath = (selectedFile as File & { path: string }).path
    const result = await firmwareIpc.updateViaUsb(portPath, filePath)
    if (!result.success) {
      setUpdateState('error')
      setErrorMsg(result.error ?? 'Flash failed — check the device is in normal boot mode')
      log('error', `Firmware flash failed: ${result.error ?? 'unknown'}`)
    }
  }

  const handleReset = () => {
    setUpdateState('idle')
    setSelectedFile(null)
    setProgress(0)
    setErrorMsg(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ---- Flash latest ----

  const canFlashLatest = (connected || simulationMode) && latestRelease !== null

  const handleFlashLatest = async () => {
    if (!latestRelease) return
    if (simulationMode) {
      log('info', `Flash latest (sim) — v${latestRelease.version}`)
      setLatestState('downloading')
      setLatestProgress(0)
      setLatestPhase('downloading')
      await new Promise<void>((r) => setTimeout(r, 800))
      setLatestProgress(100)
      setLatestPhase('flashing')
      setLatestState('flashing')
      let p = 0
      await new Promise<void>((r) => {
        const id = setInterval(() => {
          p += Math.random() * 12
          if (p >= 100) {
            p = 100
            clearInterval(id)
            setLatestProgress(100)
            setLatestState('done')
            log('success', `Flash latest complete (sim) — v${latestRelease.version}`)
            r()
          } else {
            setLatestProgress(p)
          }
        }, 120)
      })
      return
    }
    if (!portPath) {
      setLatestError('No port path available — reconnect the device')
      setLatestState('error')
      return
    }
    setLatestState('downloading')
    setLatestProgress(0)
    setLatestPhase('downloading')
    log('info', `Downloading firmware v${latestRelease.version}…`)
    const result = await firmwareIpc.flashLatest(channel, portPath)
    if (!result.success) {
      setLatestState('error')
      setLatestError(result.error ?? 'Flash failed')
      log('error', `Flash latest failed: ${result.error ?? 'unknown'}`)
    } else {
      log(
        'success',
        `Firmware v${result.version ?? latestRelease.version} flashed — reboot the device`
      )
    }
  }

  const handleLatestReset = () => {
    setLatestState('idle')
    setLatestProgress(0)
    setLatestError(null)
  }

  const latestBusy = latestState === 'downloading' || latestState === 'flashing'

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
        <IconUsb size={16} color={connected || simulationMode ? '#55AA55' : '#AAAAAA'} />
        <div>
          <div style={{ fontSize: 12, color: '#AAAAAA', fontWeight: 600 }}>
            {simulationMode
              ? 'Simulation mode'
              : connected
                ? 'Device connected'
                : 'No device connected'}
          </div>
          {firmwareVersion && (
            <div style={{ fontSize: 11, color: '#AAAAAA', marginTop: 2 }}>
              Current firmware: v{firmwareVersion}
            </div>
          )}
          {!connected && !simulationMode && (
            <div style={{ fontSize: 11, color: '#AAAAAA', marginTop: 2 }}>
              Connect via USB to enable flashing
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Flash Latest                                                         */}
      {/* ------------------------------------------------------------------ */}
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: '#161616',
          border: '1px solid #222222',
          borderRadius: 6,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Section title + channel toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#CCCCCC',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Flash Latest
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['stable', 'beta'] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => {
                  setChannel(ch)
                  handleLatestReset()
                }}
                disabled={latestBusy}
                style={{
                  padding: '2px 8px',
                  background: channel === ch ? '#1A1A2A' : 'transparent',
                  border: `1px solid ${channel === ch ? '#4455AA' : '#2A2A2A'}`,
                  borderRadius: 3,
                  color: channel === ch ? '#7788CC' : '#555555',
                  fontSize: 10,
                  cursor: latestBusy ? 'default' : 'pointer',
                  letterSpacing: '0.04em',
                }}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>

        {/* Release info */}
        {latestLoading && (
          <div style={{ fontSize: 11, color: '#555555' }}>Fetching latest release…</div>
        )}
        {!latestLoading && latestRelease && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#CCCCCC' }}>
              v{latestRelease.version}
            </span>
            <span style={{ fontSize: 10, color: '#555555' }}>
              {new Date(latestRelease.publishedAt).toLocaleDateString()}
            </span>
            {latestRelease.prerelease && (
              <span
                style={{
                  fontSize: 9,
                  color: '#AA7733',
                  border: '1px solid #553311',
                  borderRadius: 3,
                  padding: '1px 4px',
                  letterSpacing: '0.05em',
                }}
              >
                PRE-RELEASE
              </span>
            )}
          </div>
        )}
        {!latestLoading && latestError && latestState !== 'error' && (
          <div style={{ fontSize: 11, color: '#884444' }}>{latestError}</div>
        )}

        {/* Download/flash progress */}
        {latestBusy && (
          <div>
            <div style={{ height: 3, background: '#1C1C1C', borderRadius: 2, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${String(Math.round(latestProgress))}%`,
                  background: latestPhase === 'downloading' ? '#4477CC' : '#FF4444',
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
              <span>{latestPhase === 'downloading' ? 'Downloading…' : 'Flashing…'}</span>
              <span>{Math.round(latestProgress)}%</span>
            </div>
          </div>
        )}

        {/* Done */}
        {latestState === 'done' && (
          <div style={{ fontSize: 11, color: '#55AA55' }}>
            ✓ Flashed successfully. Reboot the device to apply.
          </div>
        )}

        {/* Error */}
        {latestState === 'error' && latestError && (
          <div style={{ fontSize: 11, color: '#CC4444' }}>{latestError}</div>
        )}

        {/* Action row */}
        <div style={{ display: 'flex', gap: 8 }}>
          {(latestState === 'done' || latestState === 'error') && (
            <button
              onClick={handleLatestReset}
              style={{
                flex: 1,
                padding: '7px 0',
                background: 'transparent',
                border: '1px solid #2A2A2A',
                borderRadius: 5,
                color: '#AAAAAA',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
          )}
          <button
            onClick={handleFlashLatest}
            disabled={!canFlashLatest || latestBusy || latestState === 'done'}
            style={{
              flex: 3,
              padding: '7px 0',
              background: canFlashLatest && latestState !== 'done' ? '#1A1A0D' : '#111111',
              border: `1px solid ${canFlashLatest && latestState !== 'done' ? '#CC8800' : '#222222'}`,
              borderRadius: 5,
              color: canFlashLatest && latestState !== 'done' ? '#CCAA33' : '#333333',
              fontSize: 11,
              fontWeight: 600,
              cursor:
                canFlashLatest && !latestBusy && latestState !== 'done' ? 'pointer' : 'default',
              letterSpacing: '0.04em',
            }}
          >
            {latestBusy
              ? latestPhase === 'downloading'
                ? 'Downloading…'
                : 'Flashing…'
              : 'Flash Latest'}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Manual file flash                                                    */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ width: '100%', maxWidth: 480 }}>
        <label
          style={{
            display: 'block',
            fontSize: 10,
            color: '#555555',
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
          disabled={updateState === 'flashing'}
          style={{
            width: '100%',
            padding: '10px 16px',
            background: '#161616',
            border: `1px dashed ${selectedFile ? '#336633' : '#2A2A2A'}`,
            borderRadius: 6,
            color: selectedFile ? '#55AA55' : '#AAAAAA',
            fontSize: 12,
            cursor: updateState === 'flashing' ? 'default' : 'pointer',
            textAlign: 'center',
            transition: 'border-color 0.1s, color 0.1s',
          }}
          onMouseEnter={(e) => {
            if (updateState !== 'flashing')
              e.currentTarget.style.borderColor = selectedFile ? '#448844' : '#AAAAAA'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = selectedFile ? '#336633' : '#2A2A2A'
          }}
        >
          {selectedFile ? `✓ ${selectedFile.name}` : 'Select firmware file…'}
        </button>
      </div>

      {/* Progress bar (manual flash) */}
      {updateState === 'flashing' && (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <div style={{ height: 4, background: '#1C1C1C', borderRadius: 2, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${String(Math.round(progress))}%`,
                background: '#FF4444',
                borderRadius: 2,
                transition: 'width 0.1s',
              }}
            />
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: '#AAAAAA', textAlign: 'right' }}>
            {Math.round(progress)}%
          </div>
        </div>
      )}

      {/* Done state (manual flash) */}
      {updateState === 'done' && (
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

      {/* Error state (manual flash) */}
      {(updateState === 'error' || errorMsg) && (
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
          {errorMsg ?? 'An unknown error occurred'}
        </div>
      )}

      {/* Actions (manual flash) */}
      <div style={{ width: '100%', maxWidth: 480, display: 'flex', gap: 10 }}>
        {updateState !== 'idle' && (
          <button
            onClick={handleReset}
            disabled={updateState === 'flashing'}
            style={{
              flex: 1,
              padding: '8px 0',
              background: 'transparent',
              border: '1px solid #2A2A2A',
              borderRadius: 5,
              color: '#AAAAAA',
              fontSize: 12,
              cursor: updateState === 'flashing' ? 'default' : 'pointer',
            }}
          >
            Reset
          </button>
        )}
        <button
          onClick={handleFlash}
          disabled={!canFlash || updateState === 'flashing' || updateState === 'done'}
          style={{
            flex: 3,
            padding: '8px 0',
            background: canFlash && updateState !== 'done' ? '#1A0D0D' : '#111111',
            border: `1px solid ${canFlash && updateState !== 'done' ? '#CC3333' : '#222222'}`,
            borderRadius: 5,
            color: canFlash && updateState !== 'done' ? '#CC4444' : '#333333',
            fontSize: 12,
            fontWeight: 600,
            cursor:
              canFlash && updateState !== 'flashing' && updateState !== 'done'
                ? 'pointer'
                : 'default',
            letterSpacing: '0.04em',
          }}
        >
          {updateState === 'flashing' ? 'Flashing…' : 'Flash Firmware'}
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
          color: '#333333',
        }}
      >
        Wi-Fi OTA — Phase 2
      </div>
    </div>
  )
}

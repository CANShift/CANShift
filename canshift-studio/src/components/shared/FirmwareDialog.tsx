// FirmwareDialog.tsx — Modal for initial firmware flash and firmware updates.
//
// Shown automatically when:
//   - Device connects but doesn't respond to version probe ('flash' mode)
//   - Device firmware is outdated compared to latest GitHub release ('update' mode)
//
// Flash process:
//   1. Main process disconnects Node.js serial port and registers Web Serial auto-select.
//   2. Renderer downloads the merged binary from GitHub.
//   3. esptool-js opens the port via Web Serial API and flashes.
//   4. Device reboots; studio reconnects automatically.

import { useState, useEffect, useCallback } from 'react'
import { ESPLoader, Transport } from 'esptool-js'
import SparkMD5 from 'spark-md5'
import { useDeviceStore } from '../../stores/device.store'
import { firmwareIpc, usbService } from '../../services/ipc.service'
import type { FirmwareRelease } from '../../services/ipc.service'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FlashState = 'idle' | 'downloading' | 'connecting' | 'flashing' | 'done' | 'error'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a binary ArrayBuffer to the Latin-1 string that esptool-js expects. */
function bufferToString(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let str = ''
  for (const byte of bytes) {
    str += String.fromCharCode(byte)
  }
  return str
}

/** Download a URL and return its content as an ArrayBuffer, reporting progress. */
async function downloadBinary(
  url: string,
  onProgress: (pct: number) => void
): Promise<ArrayBuffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Download failed: ' + String(response.status))

  const total = parseInt(response.headers.get('content-length') ?? '0', 10)
  const { body } = response
  if (!body) throw new Error('No response body')
  const reader = body.getReader()

  const chunks: Uint8Array[] = []
  let received = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
    if (total > 0) onProgress(Math.min(99, Math.round((received / total) * 100)))
  }

  const total2 = chunks.reduce((acc, c) => acc + c.length, 0)
  const merged = new Uint8Array(total2)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }

  onProgress(100)
  return merged.buffer
}

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
  const setConnected = useDeviceStore((s) => s.setConnected)
  const setDisconnected = useDeviceStore((s) => s.setDisconnected)

  const [channel, setChannel] = useState<'stable' | 'beta'>('stable')
  const [releases, setReleases] = useState<FirmwareRelease[]>([])
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [flashState, setFlashState] = useState<FlashState>('idle')
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  const { visible, mode } = firmwareDialog

  // Fetch release list whenever the dialog opens or channel changes
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
        setErrorMsg('Could not fetch releases — check internet connection')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [visible, channel])

  const selectedRelease: FirmwareRelease | undefined = releases.find((r) => r.tag === selectedTag)

  const handleClose = useCallback(() => {
    if (flashState === 'flashing' || flashState === 'downloading' || flashState === 'connecting')
      return
    setFirmwareDialog({ visible: false, mode: null })
    setFlashState('idle')
    setProgress(0)
    setErrorMsg('')
  }, [flashState, setFirmwareDialog])

  const handleFlash = useCallback(async () => {
    if (!selectedRelease || !portPath) return

    setFlashState('downloading')
    setProgress(0)
    setErrorMsg('')

    try {
      // 1. Enter flash mode — main closes USB serial, enables Web Serial auto-select
      await firmwareIpc.enterFlash(portPath)
      setDisconnected()

      // 2. Download merged firmware binary
      const binBuffer = await downloadBinary(selectedRelease.downloadUrl, (pct) => {
        setProgress(Math.round(pct * 0.4)) // 0-40% = download
      })
      const binString = bufferToString(binBuffer)

      // 3. Open Web Serial port (main auto-selects via select-serial-port handler)
      setFlashState('connecting')
      const port = await navigator.serial.requestPort()
      await port.open({ baudRate: 115200 })

      // 4. Flash with esptool-js.
      // ESLint cannot resolve the esptool-js type definitions at analysis time;
      // disable the unsafe-call rules for the duration of this block.
      setFlashState('flashing')
      /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
      const transport = new Transport(port, false)
      const loader = new ESPLoader({
        transport,
        baudrate: 921600,
        romBaudrate: 115200,
        enableTracing: false,
      })

      await loader.main()

      await loader.writeFlash({
        fileArray: [{ data: binString, address: 0x1000 }],
        flashSize: 'keep',
        flashMode: 'keep',
        flashFreq: 'keep',
        eraseAll: false,
        compress: true,
        reportProgress: (_idx: number, written: number, total: number) => {
          const pct = 40 + Math.round((written / total) * 55) // 40-95%
          setProgress(pct)
        },
        calculateMD5Hash: (image: string) => SparkMD5.hashBinary(image),
      })

      await loader.hardReset()
      await transport.disconnect()
      /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */

      await port.close()

      setProgress(100)
      setFlashState('done')

      // Exit flash mode
      await firmwareIpc.exitFlash()

      // Auto-reconnect after device reboots (~3s)
      setTimeout(() => {
        usbService
          .connect(portPath)
          .then((result) => {
            if (result.success) setConnected(portPath)
          })
          .catch(() => {
            /* reconnect is best-effort */
          })
      }, 3_500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(msg)
      setFlashState('error')
      await firmwareIpc.exitFlash().catch((_err: unknown) => {
        /* best-effort cleanup */
      })
    }
  }, [selectedRelease, portPath, setDisconnected, setConnected])

  if (!visible) return null

  const isFlashing =
    flashState === 'downloading' || flashState === 'connecting' || flashState === 'flashing'

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
          {flashState === 'done' ? (
            <DonePanel onClose={handleClose} />
          ) : flashState === 'error' ? (
            <ErrorPanel
              message={errorMsg}
              onRetry={() => {
                setFlashState('idle')
              }}
            />
          ) : isFlashing ? (
            <ProgressPanel state={flashState} progress={progress} />
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
                    {errorMsg || 'No releases found for this channel'}
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
        {!isFlashing && flashState !== 'done' && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid #222222',
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
            }}
          >
            {flashState !== 'error' && (
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
            {flashState !== 'error' && (
              <button
                onClick={() => void handleFlash()}
                disabled={!selectedRelease || !portPath || loading}
                style={{
                  padding: '7px 20px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: selectedRelease && portPath && !loading ? 'pointer' : 'not-allowed',
                  border: 'none',
                  background: selectedRelease && portPath && !loading ? '#CC3333' : '#332222',
                  color: selectedRelease && portPath && !loading ? '#FFFFFF' : '#666666',
                }}
              >
                {mode === 'flash' ? 'Flash Firmware' : 'Update'}
              </button>
            )}
            {flashState === 'error' && (
              <button
                onClick={() => {
                  setFlashState('idle')
                  setErrorMsg('')
                }}
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

function ProgressPanel({ state, progress }: { state: FlashState; progress: number }) {
  const label =
    state === 'downloading'
      ? 'Downloading firmware…'
      : state === 'connecting'
        ? 'Connecting to device…'
        : 'Flashing…'

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
      <div style={{ fontSize: 11, color: '#555555', textAlign: 'right' }}>{progress}%</div>
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

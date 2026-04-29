// UpdateRoute.tsx — Firmware update panel (USB OTA, Phase 1)

import { useState, useRef } from 'react'
import { useDeviceStore } from '../stores/device.store'
import { useLogStore } from '../stores/log.store'
import { IconUsb } from '../components/icons/Icon'

type UpdateState = 'idle' | 'selecting' | 'ready' | 'flashing' | 'done' | 'error'

export default function UpdateRoute() {
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const firmwareVersion = useDeviceStore((s) => s.firmwareVersion)
  const log = useLogStore((s) => s.push)

  const [updateState, setUpdateState] = useState<UpdateState>('idle')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleFlash = () => {
    if (!connected && !simulationMode) return
    if (!selectedFile) return
    if (simulationMode) {
      log('info', `Firmware update (sim) — ${selectedFile.name}`)
      setUpdateState('flashing')
      setProgress(0)
      // Simulate progress
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
    // TODO: send file over USB via firmware:update-usb IPC channel
    log('warn', `USB firmware flash not yet implemented — ${selectedFile.name}`)
    setUpdateState('error')
    setErrorMsg('USB OTA not yet implemented in this build')
  }

  const handleReset = () => {
    setUpdateState('idle')
    setSelectedFile(null)
    setProgress(0)
    setErrorMsg(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

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
        <p style={{ fontSize: 12, color: '#444444' }}>
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
        <IconUsb size={16} color={connected || simulationMode ? '#55AA55' : '#444444'} />
        <div>
          <div
            style={{
              fontSize: 12,
              color: connected || simulationMode ? '#AAAAAA' : '#555555',
              fontWeight: 600,
            }}
          >
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
            <div style={{ fontSize: 11, color: '#444444', marginTop: 2 }}>
              Connect via USB to enable flashing
            </div>
          )}
        </div>
      </div>

      {/* File selector */}
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
          Firmware binary (.bin)
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
            color: selectedFile ? '#55AA55' : '#444444',
            fontSize: 12,
            cursor: updateState === 'flashing' ? 'default' : 'pointer',
            textAlign: 'center',
            transition: 'border-color 0.1s, color 0.1s',
          }}
          onMouseEnter={(e) => {
            if (updateState !== 'flashing')
              e.currentTarget.style.borderColor = selectedFile ? '#448844' : '#444444'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = selectedFile ? '#336633' : '#2A2A2A'
          }}
        >
          {selectedFile ? `✓ ${selectedFile.name}` : 'Select firmware file…'}
        </button>
      </div>

      {/* Progress bar */}
      {updateState === 'flashing' && (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <div
            style={{
              height: 4,
              background: '#1C1C1C',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
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
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: '#555555',
              textAlign: 'right',
            }}
          >
            {Math.round(progress)}%
          </div>
        </div>
      )}

      {/* Done state */}
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

      {/* Error state */}
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

      {/* Actions */}
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          display: 'flex',
          gap: 10,
        }}
      >
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
              color: '#444444',
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

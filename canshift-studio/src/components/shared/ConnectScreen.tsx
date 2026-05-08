// ConnectScreen.tsx — Full-screen shown when no device is connected and not in simulation

import { useState } from 'react'
import { useDeviceStore } from '../../stores/device.store'
import { useDashboardStore } from '../../stores/dashboard.store'
import { useLogStore } from '../../stores/log.store'
import { useConfigActions } from '../../hooks/useConfigActions'
import ConnectModal from './ConnectModal'
import { IconUsb, IconSimulation, IconLoad } from '../icons/Icon'

export default function ConnectScreen() {
  const [modalOpen, setModalOpen] = useState(false)
  const enterSimulation = useDeviceStore((s) => s.enterSimulation)
  const loadFromDeviceOrDemo = useDashboardStore((s) => s.loadFromDeviceOrDemo)
  const log = useLogStore((s) => s.push)
  const { openConfig } = useConfigActions()

  const handleSimulation = () => {
    // Atomic decision against the latest store state (#216): keeps mid-edit
    // work, falls back to the demo only when the editor is empty.
    const outcome = loadFromDeviceOrDemo(null)
    enterSimulation()
    if (outcome === 'demo') {
      log('info', 'Simulation mode — default config loaded')
    } else {
      log('info', 'Simulation mode — using loaded config')
    }
  }

  const handleLoadAndSimulate = () => {
    openConfig()
    // After open, user can click Simulation again with the loaded config
  }

  return (
    <>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 32,
          background: '#0D0D0D',
        }}
      >
        {/* Icon */}
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity={0.15}>
          <rect x="6" y="10" width="36" height="28" rx="3" stroke="#FFFFFF" strokeWidth="2" />
          <path
            d="M16 38v4M32 38v4M12 42h24"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="24" cy="24" r="6" stroke="#FFFFFF" strokeWidth="2" />
        </svg>

        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 15, color: '#3A3A3A', marginBottom: 6 }}>No device connected</p>
          <p style={{ fontSize: 12, color: '#2A2A2A' }}>
            Connect a CANShift screen via USB or run in simulation
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 240 }}>
          <button
            onClick={() => {
              setModalOpen(true)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 0',
              background: '#CC3333',
              border: 'none',
              borderRadius: 6,
              color: '#FFFFFF',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <IconUsb size={15} color="#FFFFFF" />
            Connect Device
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSimulation}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 0',
                background: 'transparent',
                border: '1px solid #2A2A2A',
                borderRadius: 6,
                color: '#666666',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <IconSimulation size={13} color="#666666" />
              Simulation
            </button>
            <button
              onClick={handleLoadAndSimulate}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 0',
                background: 'transparent',
                border: '1px solid #2A2A2A',
                borderRadius: 6,
                color: '#666666',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <IconLoad size={13} color="#666666" />
              Load config…
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <ConnectModal
          onClose={() => {
            setModalOpen(false)
          }}
        />
      )}
    </>
  )
}

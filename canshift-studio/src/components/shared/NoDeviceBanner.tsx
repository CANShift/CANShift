// NoDeviceBanner.tsx — Thin notice shown when no device is connected

import { useState } from 'react'
import { useDeviceStore } from '../../stores/device.store'
import ConnectModal from './ConnectModal'

export default function NoDeviceBanner() {
  const connected = useDeviceStore((s) => s.connected)
  const [modalOpen, setModalOpen] = useState(false)

  if (connected) return null

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          height: 30,
          background: '#110A00',
          borderBottom: '1px solid #2A1A00',
          fontSize: 11,
          color: '#664400',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#443300',
            flexShrink: 0,
          }}
        />
        No device connected —
        <button
          onClick={() => {
            setModalOpen(true)
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#886622',
            cursor: 'pointer',
            fontSize: 11,
            padding: 0,
            textDecoration: 'underline',
          }}
        >
          Connect
        </button>
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

// UpdateBanner.tsx — Non-intrusive banner shown when a studio update is available

import { useUpdater } from '../../hooks/useUpdater'

export default function UpdateBanner() {
  const { status, version, installUpdate } = useUpdater()

  if (status === 'idle' || status === 'error') return null

  const isReady = status === 'downloaded'

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 32,
        right: 16,
        zIndex: 9999,
        background: '#161616',
        border: `1px solid ${isReady ? '#CC4444' : '#2A2A2A'}`,
        borderRadius: 6,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 12,
        color: '#AAAAAA',
        boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
      }}
    >
      <span>
        {isReady ? `v${version ?? ''} ready to install` : `Downloading v${version ?? ''}…`}
      </span>
      {isReady && (
        <button
          onClick={installUpdate}
          style={{
            padding: '4px 10px',
            background: '#1A0D0D',
            border: '1px solid #CC3333',
            borderRadius: 4,
            color: '#CC4444',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '0.04em',
          }}
        >
          Restart &amp; Install
        </button>
      )}
    </div>
  )
}

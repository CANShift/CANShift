// UpdateBanner.tsx — Non-intrusive banner shown when a studio update is available

import { useUpdater } from '../../hooks/useUpdater'
import { Button } from '@/components/ui/button'

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
        <Button variant="default" size="sm" onClick={installUpdate} className="tracking-wider">
          Restart &amp; Install
        </Button>
      )}
    </div>
  )
}

// UpdateBanner.tsx — Non-intrusive banner shown when a studio update is available

import { useUpdater } from '../../hooks/useUpdater'
import { Button } from '@/components/ui/button'

// Chrome shades not yet promoted to core tokens (audit S-H-5, umbrella #1015).
// Hoisted so a future token promotion is a one-line swap.
const BANNER_BG = '#161616' // MIRROR: chrome surface, darker than --surface (#1F1F1F)
const BORDER_READY = '#CC4444' // MIRROR: dim brand red signalling "ready to install"
const BORDER_IDLE = '#2A2A2A' // MIRROR: subdued chrome divider
const BANNER_TEXT = '#AAAAAA' // MIRROR: between --text-dim (#BABABA) and --text-muted (#8F8F8F)
const BANNER_SHADOW = '0 4px 16px rgba(0,0,0,0.6)' // MIRROR: drop shadow overlay (no alpha token yet)

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
        background: BANNER_BG,
        border: `1px solid ${isReady ? BORDER_READY : BORDER_IDLE}`,
        borderRadius: 6,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 12,
        color: BANNER_TEXT,
        boxShadow: BANNER_SHADOW,
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

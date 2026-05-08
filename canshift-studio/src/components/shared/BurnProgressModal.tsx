// BurnProgressModal.tsx — Full-window status overlay during the burn cycle.
//
// Shows phase-aware copy + an animated spinner so the user knows the device
// is busy writing the new config. Mirrored on the device by the firmware's
// burn overlay (#171 follow-up) so feedback is visible on both screens.

import { useEffect, useState } from 'react'
import { useDeviceStore } from '../../stores/device.store'
import type { BurnPhase } from '../../stores/device.store'
import PhaseIndicator from './PhaseIndicator'
import type { PhaseTone } from './PhaseIndicator'

interface PhaseCopy {
  title: string
  detail: string
  tone: PhaseTone
}

const PHASE_COPY: Record<Exclude<BurnPhase, 'idle'>, PhaseCopy> = {
  pushing: {
    title: 'Pushing config to device…',
    detail: 'Sending dashboard JSON over USB.',
    tone: 'progress',
  },
  rebooting: {
    title: 'Device writing & rebooting…',
    detail: 'Saving to SD and restarting. The device will be back in a few seconds.',
    tone: 'progress',
  },
  done: {
    title: 'Done',
    detail: 'Device reconnected — your config is live.',
    tone: 'success',
  },
}

export default function BurnProgressModal() {
  const burnPhase = useDeviceStore((s) => s.burnPhase)
  const [shown, setShown] = useState<Exclude<BurnPhase, 'idle'> | null>(null)

  // Keep the previous phase mounted briefly so the modal can fade out on idle
  // rather than disappearing instantly. Without this, a fast cycle leaves the
  // user staring at a popped-away dialog.
  useEffect(() => {
    if (burnPhase === 'idle') {
      const t = setTimeout(() => {
        setShown(null)
      }, 200)
      return () => {
        clearTimeout(t)
      }
    }
    setShown(burnPhase)
    return undefined
  }, [burnPhase])

  if (shown === null) return null

  const copy = PHASE_COPY[shown]
  const visible = burnPhase !== 'idle'

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        background: '#00000088',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9000,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.2s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        style={{
          background: '#161616',
          border: '1px solid #2A2A2A',
          borderRadius: 8,
          padding: '24px 32px',
          minWidth: 320,
          maxWidth: 460,
          boxShadow: '0 8px 32px #00000088',
        }}
      >
        <PhaseIndicator tone={copy.tone} title={copy.title} detail={copy.detail} />
      </div>
    </div>
  )
}

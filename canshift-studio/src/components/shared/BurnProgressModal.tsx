// BurnProgressModal.tsx — Full-window status overlay during the burn cycle.
//
// Shows phase-aware copy + an animated spinner so the user knows the device
// is busy writing the new config. Mirrored on the device by the firmware's
// burn overlay (#171 follow-up) so feedback is visible on both screens.

import { useEffect, useState } from 'react'
import { useDeviceStore } from '../../stores/device.store'
import type { BurnPhase } from '../../stores/device.store'

interface PhaseCopy {
  title: string
  detail: string
  /** Tone — drives the spinner / dot color. */
  tone: 'progress' | 'success'
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

function Spinner({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="13" fill="none" stroke="#1A1A1A" strokeWidth="3" />
      <circle
        cx="16"
        cy="16"
        r="13"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="22 60"
        transform="rotate(-90 16 16)"
        style={{
          transformOrigin: '16px 16px',
          animation: 'canshift-spin 1.1s linear infinite',
        }}
      />
    </svg>
  )
}

let _spinKeyframesInjected = false
function ensureSpinKeyframes(): void {
  if (_spinKeyframesInjected) return
  _spinKeyframesInjected = true
  const el = document.createElement('style')
  el.textContent =
    '@keyframes canshift-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'
  document.head.appendChild(el)
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

  useEffect(() => {
    if (shown !== null) ensureSpinKeyframes()
  }, [shown])

  if (shown === null) return null

  const copy = PHASE_COPY[shown]
  const accent = copy.tone === 'success' ? '#3DB86B' : '#E08030'
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
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          boxShadow: '0 8px 32px #00000088',
        }}
      >
        {copy.tone === 'success' ? (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0A0A0A',
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            ✓
          </div>
        ) : (
          <Spinner color={accent} />
        )}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF', marginBottom: 4 }}>
            {copy.title}
          </div>
          <div style={{ fontSize: 12, color: '#888888', lineHeight: 1.5 }}>{copy.detail}</div>
        </div>
      </div>
    </div>
  )
}

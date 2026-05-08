// PhaseIndicator.tsx — Shared progress / success / error indicator with a
// spinner, used by BurnProgressModal and the firmware update panel.

import { useEffect } from 'react'

export type PhaseTone = 'progress' | 'success' | 'error'

const TONE_COLOR: Record<PhaseTone, string> = {
  progress: '#E08030',
  success: '#3DB86B',
  error: '#CC4444',
}

export function Spinner({ color, size = 32 }: { color: string; size?: number }) {
  useEffect(() => {
    ensureSpinKeyframes()
  }, [])
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
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

let _keyframesInjected = false

/**
 * Lazily injects the global @keyframes used by both the spinner and the
 * SideRail's update-pulse dot. Idempotent — safe to call from multiple
 * components without duplicating the <style> tag.
 */
export function ensureSpinKeyframes(): void {
  if (_keyframesInjected) return
  _keyframesInjected = true
  const el = document.createElement('style')
  el.textContent =
    '@keyframes canshift-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }' +
    '@keyframes canshift-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.8); } }'
  document.head.appendChild(el)
}

export interface PhaseIndicatorProps {
  tone: PhaseTone
  title: string
  detail?: string
  size?: number
}

export default function PhaseIndicator({ tone, title, detail, size = 32 }: PhaseIndicatorProps) {
  useEffect(() => {
    ensureSpinKeyframes()
  }, [])

  const color = TONE_COLOR[tone]

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
      }}
    >
      {tone === 'success' ? (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0A0A0A',
            fontSize: Math.round(size * 0.56),
            fontWeight: 700,
          }}
        >
          ✓
        </div>
      ) : tone === 'error' ? (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0A0A0A',
            fontSize: Math.round(size * 0.56),
            fontWeight: 700,
          }}
        >
          !
        </div>
      ) : (
        <Spinner color={color} size={size} />
      )}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF', marginBottom: 4 }}>
          {title}
        </div>
        {detail && <div style={{ fontSize: 12, color: '#888888', lineHeight: 1.5 }}>{detail}</div>}
      </div>
    </div>
  )
}

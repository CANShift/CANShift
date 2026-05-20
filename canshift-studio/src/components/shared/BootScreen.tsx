// BootScreen.tsx — Branded splash shown while the renderer hydrates.
//
// The studio's first paint takes ~200–600 ms (React mount + design-tokens.css
// + the signal / dashboard store reads). Before this splash landed the user
// stared at a black window during that window and couldn't tell whether
// the studio was loading or stuck — issue #968.
//
// The splash advances through four labelled stages on a fixed timeline so
// the user sees deterministic progress even on cold launches. Stores in
// this codebase read localStorage synchronously on module init, so we
// don't gate the splash on any real hydration signal — the timeline is
// purely cosmetic. Click anywhere (or press Esc) to skip.

import { useEffect, useState, type ReactNode } from 'react'

interface BootStage {
  label: string
  /** Cumulative ms — the stage is "current" when elapsed ≥ this and the next
   *  stage's mark is still ahead. The last stage's mark equals total duration. */
  mark: number
}

const STAGES: readonly BootStage[] = [
  { label: 'Loading design tokens', mark: 0 },
  { label: 'Restoring signal catalog', mark: 350 },
  { label: 'Restoring dashboard', mark: 700 },
  { label: 'Ready', mark: 1050 },
]

const TOTAL_MS = 1200
const FADE_MS = 200

interface BootScreenProps {
  onDone: () => void
}

export function BootScreen({ onDone }: BootScreenProps): ReactNode {
  const [elapsed, setElapsed] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const start = performance.now()
    const handle = window.setInterval(() => {
      const e = performance.now() - start
      setElapsed(e)
      if (e >= TOTAL_MS) {
        window.clearInterval(handle)
        setFading(true)
        window.setTimeout(onDone, FADE_MS)
      }
    }, 33)
    return () => {
      window.clearInterval(handle)
    }
  }, [onDone])

  useEffect(() => {
    const skip = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      setFading(true)
      window.setTimeout(onDone, FADE_MS)
    }
    window.addEventListener('keydown', skip)
    return () => {
      window.removeEventListener('keydown', skip)
    }
  }, [onDone])

  const pct = Math.min(100, (elapsed / TOTAL_MS) * 100)
  // findLast — pick the most recent stage whose mark has been crossed.
  // Walking backwards avoids the lib.es2023 dependency required for
  // `Array.prototype.findLast` (our tsconfig targets es2022).
  const currentStage = (() => {
    for (let i = STAGES.length - 1; i >= 0; i--) {
      const stage = STAGES[i]
      if (stage && elapsed >= stage.mark) return stage
    }
    return STAGES[0]
  })()

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={() => {
        setFading(true)
        window.setTimeout(onDone, FADE_MS)
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        background: '#0A0A0A',
        color: '#EEEEEE',
        opacity: fading ? 0 : 1,
        transition: `opacity ${String(FADE_MS)}ms ease-out`,
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          fontFamily: 'Orbitron, system-ui, sans-serif',
          fontWeight: 900,
          fontSize: 36,
          letterSpacing: '0.18em',
          color: '#CC3333',
        }}
      >
        CANSHIFT
      </div>
      <div
        style={{
          width: 260,
          height: 3,
          background: '#1A1A1A',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct.toFixed(1)}%`,
            height: '100%',
            background: '#CC3333',
            transition: 'width 80ms linear',
          }}
        />
      </div>
      <div
        style={{
          fontSize: 11,
          color: '#888888',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          height: 14,
        }}
      >
        {currentStage?.label ?? ''}
      </div>
      <div
        style={{
          fontSize: 9,
          color: '#444444',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          position: 'absolute',
          bottom: 16,
        }}
      >
        Press Esc or click to skip
      </div>
    </div>
  )
}

// CliDetachedShell.tsx — Standalone renderer for the detached CLI window
// (issue #433). The window only mounts <CliTerminal detached /> plus the log
// bridge so lines arriving in the main window keep flowing in.

import { lazy, Suspense, type ReactElement } from 'react'
import { useCliLogBridge } from '../../cli/useCliLogBridge'

const CliTerminal = lazy(() => import('./CliTerminal'))

export default function CliDetachedShell(): ReactElement {
  // Bridge mounts here so the detached window receives broadcasts even before
  // the lazy CliTerminal chunk has resolved.
  useCliLogBridge()

  return (
    <div
      style={{
        height: '100vh',
        background: '#0A0A0A',
        color: '#FFFFFF',
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Suspense
        fallback={
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3A3A3A',
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Loading CLI…
          </div>
        }
      >
        <CliTerminal detached />
      </Suspense>
    </div>
  )
}

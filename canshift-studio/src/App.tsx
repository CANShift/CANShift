// App.tsx — Root component and route definitions

import { lazy, Suspense, type ReactElement } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

// All routes are code-split. `EditorRoute` is the largest payload (Canvas,
// WidgetPalette, PropertyPanel, TestValuesPanel) so deferring it shaves the
// initial chunk substantially even though `/editor` is the default landing
// route — the chunk fetches in parallel while the Suspense fallback renders.
// Audit S-M-1, umbrella #1015.
const EditorRoute = lazy(() => import('./routes/EditorRoute'))
const SignalRoute = lazy(() => import('./routes/SignalRoute'))
const UpdateRoute = lazy(() => import('./routes/UpdateRoute'))
const CanScannerRoute = lazy(() => import('./routes/CanScannerRoute'))
const DeviceConfigRoute = lazy(() => import('./routes/DeviceConfigRoute'))

// CliTerminal — xterm-backed CLI panel (issue #378). Lazy so xterm + addons
// stay out of the main renderer chunk and the bundle budget holds.
const CliTerminal = lazy(() => import('./components/shared/CliTerminal'))
// Tiny re-attach button rendered in the in-app slot while the CLI is detached
// (issue #433). Lazy too so the typical attached path doesn't pay for it.
const CliReattachStub = lazy(() => import('./components/shared/CliReattachStub'))

function CliPanelFallback() {
  // Lightweight placeholder while the xterm chunk is fetching. Matches the
  // panel chrome (dark background, top border) so the layout doesn't jump.
  // Colors flow through CSS vars (#906) — no hex literals in renderer source.
  return (
    <div
      style={{
        height: 240,
        flexShrink: 0,
        background: 'hsl(var(--bg))',
        borderTop: '1px solid hsl(var(--border))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'hsl(var(--text-muted))',
        fontSize: 10,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}
    >
      Loading CLI…
    </div>
  )
}

function RouteLoading() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'hsl(var(--text-dim))',
        fontSize: 12,
      }}
    >
      Loading…
    </div>
  )
}
import TopBar from './components/shared/TopBar'
import SideRail from './components/shared/SideRail'
import ConnectScreen from './components/shared/ConnectScreen'
import StatusBar from './components/shared/StatusBar'
import ErrorBar from './components/shared/ErrorBar'
import UpdateBanner from './components/shared/UpdateBanner'
import VersionMismatchBanner from './components/shared/VersionMismatchBanner'
import DemoFallbackBanner from './components/shared/DemoFallbackBanner'
import BootLoopBanner from './components/shared/BootLoopBanner'
import ErrorBoundary from './components/shared/ErrorBoundary'
import { useApplicationBoot } from './hooks/useApplicationBoot'
import { useDeviceStore } from './stores/device.store'
import { useCliDetach } from './cli/useCliDetach'
import PushDiffDialog from './components/shared/PushDiffDialog'
import BurnProgressModal from './components/shared/BurnProgressModal'
import BurnFailedDialog from './components/shared/BurnFailedDialog'
import WelcomeModal from './components/shared/WelcomeModal'
import { useFirstRunCheck } from './hooks/useFirstRunCheck'
import { Toaster } from './components/ui/sonner'
import { useState } from 'react'
import { BootScreen } from './components/shared/BootScreen'

function assertNever(value: never): never {
  throw new Error(`Unhandled CLI panel state: ${JSON.stringify(value)}`)
}

export default function App() {
  // Single root-mount call — see useApplicationBoot.ts for the hook order
  // contract and rationale (audit S-L-5, umbrella #1015).
  useApplicationBoot()

  // Boot splash — hides once `BootScreen` calls back `onDone`. Lives in
  // `App` state (not a store) because every fresh React mount should replay
  // the splash, while a route change inside the running app shouldn't.
  // Issue #968.
  const [bootDone, setBootDone] = useState(false)

  const firstRun = useFirstRunCheck()
  const connected = useDeviceStore((s) => s.connected)
  const simulationMode = useDeviceStore((s) => s.simulationMode)
  const { state: cliState, reattach } = useCliDetach()

  const ready = connected || simulationMode

  let cliSurface: ReactElement
  switch (cliState.kind) {
    case 'inApp':
      cliSurface = (
        <Suspense fallback={<CliPanelFallback />}>
          <CliTerminal />
        </Suspense>
      )
      break
    case 'detached':
      cliSurface = (
        <Suspense fallback={null}>
          <CliReattachStub onReattach={reattach} />
        </Suspense>
      )
      break
    default:
      cliSurface = assertNever(cliState)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'hsl(var(--bg))',
        color: 'hsl(var(--text))',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Boot splash — overlays the app on cold start, fades out once the
          timeline completes (or Esc / click skips). The page mounts behind
          the splash so its async work runs while the splash is visible.
          Closes #968. */}
      {!bootDone && (
        <BootScreen
          onDone={() => {
            setBootDone(true)
          }}
        />
      )}
      <TopBar />

      {ready ? (
        <main style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          <SideRail />
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'stretch' }}>
            <Routes>
              <Route path="/" element={<Navigate to="/editor" replace />} />
              <Route
                path="/editor"
                element={
                  <ErrorBoundary>
                    <Suspense fallback={<RouteLoading />}>
                      <EditorRoute />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/signals"
                element={
                  <ErrorBoundary>
                    <Suspense fallback={<RouteLoading />}>
                      <SignalRoute />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/scanner"
                element={
                  <ErrorBoundary>
                    <Suspense fallback={<RouteLoading />}>
                      <CanScannerRoute />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/update"
                element={
                  <ErrorBoundary>
                    <Suspense fallback={<RouteLoading />}>
                      <UpdateRoute />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
              <Route
                path="/device-config"
                element={
                  <ErrorBoundary>
                    <Suspense fallback={<RouteLoading />}>
                      <DeviceConfigRoute />
                    </Suspense>
                  </ErrorBoundary>
                }
              />
            </Routes>
          </div>
        </main>
      ) : (
        <ConnectScreen />
      )}

      {cliSurface}
      <ErrorBar />
      <StatusBar />
      <UpdateBanner />
      <VersionMismatchBanner />
      <DemoFallbackBanner />
      <BootLoopBanner />
      <PushDiffDialog />
      <BurnProgressModal />
      <BurnFailedDialog />
      {firstRun.state === 'pending' && <WelcomeModal onDismiss={firstRun.markCompleted} />}
      <Toaster />
    </div>
  )
}
